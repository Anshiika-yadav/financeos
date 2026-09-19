import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { writeAuditLog } from '../../services/audit.service';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';

const router = Router();
router.use(authenticate, resolveTenantContext);

// ─── Chart of Accounts ────────────────────────────────────────────────────────

router.get('/accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const accounts = await prisma.glAccount.findMany({
      where: { tenantId },
      orderBy: [{ accountType: 'asc' }, { code: 'asc' }],
    });
    sendSuccess(res, accounts);
  } catch (e) { next(e); }
});

router.post('/accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      accountType: z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']),
      normalBalance: z.enum(['Debit', 'Credit']),
      parentId: z.string().uuid().optional(),
    }).parse(req.body);

    const account = await prisma.glAccount.create({ data: { tenantId, ...body } });
    await writeAuditLog({ tenantId, actorId, action: 'create', resourceType: 'account', resourceId: account.id, after: account as never });
    sendCreated(res, account);
  } catch (e) { next(e); }
});

// ─── Journals ─────────────────────────────────────────────────────────────────

router.get('/journals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const cursor = req.query.cursor as string | undefined;
    const status = req.query.status as string | undefined;

    const journals = await prisma.glJournal.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      include: { lines: { include: { account: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = journals.length > limit;
    const data = hasMore ? journals.slice(0, limit) : journals;
    sendSuccess(res, { data, nextCursor: hasMore ? data[data.length - 1].id : null, hasMore });
  } catch (e) { next(e); }
});

router.get('/journals/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const journal = await prisma.glJournal.findFirst({
      where: { id: req.params.id, tenantId },
      include: { lines: { include: { account: true } }, period: true },
    });
    if (!journal) return sendNotFound(res, 'Journal not found');
    sendSuccess(res, journal);
  } catch (e) { next(e); }
});

router.post('/journals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      description: z.string().min(1),
      fiscalPeriodId: z.string().uuid(),
      postingDate: z.string(),
      lines: z.array(z.object({
        accountId: z.string().uuid(),
        description: z.string().optional(),
        debit: z.number().min(0),
        credit: z.number().min(0),
        currency: z.string().length(3),
        dimensions: z.record(z.string()).optional(),
      })).min(2),
    }).parse(req.body);

    const totalDebit = body.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = body.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) throw new AppError(422, 'Journal must balance: debits must equal credits');

    const count = await prisma.glJournal.count({ where: { tenantId } });
    const journalNumber = `JNL-${String(count + 1).padStart(5, '0')}`;

    const journal = await prisma.glJournal.create({
      data: {
        tenantId, journalNumber, description: body.description,
        fiscalPeriodId: body.fiscalPeriodId,
        postingDate: new Date(body.postingDate),
        status: 'Draft', createdBy: actorId,
        totalDebit, totalCredit,
        lines: {
          create: body.lines.map((l, i) => ({
            tenantId, lineNumber: i + 1,
            accountId: l.accountId,
            description: l.description,
            debit: l.debit, credit: l.credit,
            currency: l.currency, exchangeRate: 1,
            dimensions: l.dimensions,
          })),
        },
      },
      include: { lines: true },
    });

    await writeAuditLog({ tenantId, actorId, action: 'create', resourceType: 'journal', resourceId: journal.id, after: journal as never });
    sendCreated(res, journal);
  } catch (e) { next(e); }
});

router.patch('/journals/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const journal = await prisma.glJournal.findFirst({ where: { id: req.params.id, tenantId } });
    if (!journal) return sendNotFound(res, 'Journal');
    if (journal.status !== 'Draft') throw new AppError(422, 'Only Draft journals can be submitted');
    const updated = await prisma.glJournal.update({ where: { id: journal.id }, data: { status: 'Pending' } });
    await writeAuditLog({ tenantId, actorId, action: 'submit', resourceType: 'journal', resourceId: journal.id, before: journal as never, after: updated as never });
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

router.patch('/journals/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const journal = await prisma.glJournal.findFirst({ where: { id: req.params.id, tenantId } });
    if (!journal) return sendNotFound(res, 'Journal');
    if (journal.status !== 'Pending') throw new AppError(422, 'Only Pending journals can be approved');
    const updated = await prisma.glJournal.update({ where: { id: journal.id }, data: { status: 'Approved', approvedBy: actorId, approvedAt: new Date() } });
    await writeAuditLog({ tenantId, actorId, action: 'approve', resourceType: 'journal', resourceId: journal.id, before: journal as never, after: updated as never });
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

router.patch('/journals/:id/post', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const journal = await prisma.glJournal.findFirst({ where: { id: req.params.id, tenantId }, include: { period: true } });
    if (!journal) return sendNotFound(res, 'Journal');
    if (!['Approved', 'Draft'].includes(journal.status)) throw new AppError(422, 'Journal cannot be posted in current status');
    if (journal.period.status === 'Locked') throw new AppError(422, 'Fiscal period is locked');
    const updated = await prisma.glJournal.update({ where: { id: journal.id }, data: { status: 'Posted', postedBy: actorId, postedAt: new Date() } });
    await writeAuditLog({ tenantId, actorId, action: 'post', resourceType: 'journal', resourceId: journal.id, before: journal as never, after: updated as never });
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

// ─── Trial Balance ─────────────────────────────────────────────────────────────

router.get('/trial-balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const accounts = await prisma.glAccount.findMany({ where: { tenantId, isActive: true } });
    const lines = await prisma.glJournalLine.findMany({
      where: { tenantId, journal: { status: 'Posted' } },
    });

    const balances = accounts.map(acc => {
      const accLines = lines.filter(l => l.accountId === acc.id);
      const totalDebit = accLines.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = accLines.reduce((s, l) => s + Number(l.credit), 0);
      return { ...acc, totalDebit, totalCredit, balance: totalDebit - totalCredit };
    }).filter(a => a.totalDebit !== 0 || a.totalCredit !== 0);

    sendSuccess(res, balances);
  } catch (e) { next(e); }
});

// ─── Fiscal Periods ───────────────────────────────────────────────────────────

router.get('/periods', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const periods = await prisma.fiscalPeriod.findMany({
      where: { tenantId },
      orderBy: { startDate: 'desc' },
    });
    sendSuccess(res, periods);
  } catch (e) { next(e); }
});

router.patch('/periods/:id/lock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const period = await prisma.fiscalPeriod.findFirst({ where: { id: req.params.id, tenantId } });
    if (!period) return sendNotFound(res, 'Period');
    const updated = await prisma.fiscalPeriod.update({ where: { id: period.id }, data: { status: 'Locked', lockedAt: new Date(), lockedBy: actorId } });
    await writeAuditLog({ tenantId, actorId, action: 'lock_period', resourceType: 'fiscal_period', resourceId: period.id });
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

export default router;
