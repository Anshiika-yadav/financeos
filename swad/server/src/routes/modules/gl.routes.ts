import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { writeAuditLogTx } from '../../services/audit.service';
import { assertCanPerform } from '../../services/permissions.service';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';

const router = Router();
router.use(authenticate, resolveTenantContext);

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const createAccountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  accountType: z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']),
  normalBalance: z.enum(['Debit', 'Credit']),
  parentId: z.string().uuid().optional(),
});

const createJournalSchema = z.object({
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
});

// ─── Chart of Accounts ────────────────────────────────────────────────────────

router.get('/accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'account', module: 'gl' });
    const accounts = await req.withTenantDb!((tx) =>
      tx.glAccount.findMany({
        where: { tenantId: req.tenantContext!.tenantId },
        orderBy: [{ accountType: 'asc' }, { code: 'asc' }],
      }),
    );
    sendSuccess(res, accounts);
  } catch (e) { next(e); }
});

router.post('/accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'account', module: 'gl' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = createAccountSchema.parse(req.body);

    const account = await req.withTenantDb!((tx) =>
      tx.glAccount.create({ data: { tenantId, ...body } }),
    );
    sendCreated(res, account);
  } catch (e) { next(e); }
});

// ─── Journals ─────────────────────────────────────────────────────────────────

router.get('/journals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'journal', module: 'gl' });
    const { tenantId } = req.tenantContext!;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const cursor = req.query.cursor as string | undefined;
    const status = req.query.status as string | undefined;

    const journals = await req.withTenantDb!((tx) =>
      tx.glJournal.findMany({
        where: { tenantId, ...(status ? { status } : {}) },
        include: { lines: { include: { account: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    );

    const hasMore = journals.length > limit;
    const data = hasMore ? journals.slice(0, limit) : journals;
    sendSuccess(res, { data, nextCursor: hasMore ? data[data.length - 1].id : null, hasMore });
  } catch (e) { next(e); }
});

router.get('/journals/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'journal', module: 'gl' });
    const { tenantId } = req.tenantContext!;

    const journal = await req.withTenantDb!((tx) =>
      tx.glJournal.findFirst({
        where: { id: req.params.id, tenantId },
        include: { lines: { include: { account: true } }, period: true },
      }),
    );
    if (!journal) return sendNotFound(res, 'Journal');
    sendSuccess(res, journal);
  } catch (e) { next(e); }
});

router.post('/journals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'journal', module: 'gl' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = createJournalSchema.parse(req.body);

    const totalDebit = body.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = body.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new AppError(422, 'Journal must balance: debits must equal credits');
    }

    const journal = await req.withTenantDb!(async (tx) => {
      const count = await tx.glJournal.count({ where: { tenantId } });
      const journalNumber = `JNL-${String(count + 1).padStart(5, '0')}`;

      const created = await tx.glJournal.create({
        data: {
          tenantId, journalNumber,
          description: body.description,
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

      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'create',
        resourceType: 'journal', resourceId: created.id,
        after: created as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });

      return created;
    });

    sendCreated(res, journal);
  } catch (e) { next(e); }
});

router.patch('/journals/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'update', { type: 'journal', module: 'gl' });
    const { tenantId, actorId } = req.tenantContext!;

    const updated = await req.withTenantDb!(async (tx) => {
      const journal = await tx.glJournal.findFirst({ where: { id: req.params.id, tenantId } });
      if (!journal) return null;
      if (journal.status !== 'Draft') throw new AppError(422, 'Only Draft journals can be submitted');

      const u = await tx.glJournal.update({ where: { id: journal.id }, data: { status: 'Pending' } });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'submit',
        resourceType: 'journal', resourceId: journal.id,
        before: journal as unknown as Record<string, unknown>,
        after: u as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return u;
    });

    if (!updated) return sendNotFound(res, 'Journal');
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

router.patch('/journals/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'approve', { type: 'journal', module: 'gl' });
    const { tenantId, actorId } = req.tenantContext!;

    const updated = await req.withTenantDb!(async (tx) => {
      const journal = await tx.glJournal.findFirst({ where: { id: req.params.id, tenantId } });
      if (!journal) return null;
      if (journal.status !== 'Pending') throw new AppError(422, 'Only Pending journals can be approved');

      const u = await tx.glJournal.update({
        where: { id: journal.id },
        data: { status: 'Approved', approvedBy: actorId, approvedAt: new Date() },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'approve',
        resourceType: 'journal', resourceId: journal.id,
        before: journal as unknown as Record<string, unknown>,
        after: u as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return u;
    });

    if (!updated) return sendNotFound(res, 'Journal');
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

router.patch('/journals/:id/post', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'post', { type: 'journal', module: 'gl' });
    const { tenantId, actorId } = req.tenantContext!;

    const updated = await req.withTenantDb!(async (tx) => {
      const journal = await tx.glJournal.findFirst({
        where: { id: req.params.id, tenantId },
        include: { period: true },
      });
      if (!journal) return null;
      if (!['Approved', 'Draft'].includes(journal.status)) {
        throw new AppError(422, 'Journal cannot be posted in current status');
      }
      if (journal.period.status === 'Locked') throw new AppError(422, 'Fiscal period is locked');

      const u = await tx.glJournal.update({
        where: { id: journal.id },
        data: { status: 'Posted', postedBy: actorId, postedAt: new Date() },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'post',
        resourceType: 'journal', resourceId: journal.id,
        before: journal as unknown as Record<string, unknown>,
        after: u as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return u;
    });

    if (!updated) return sendNotFound(res, 'Journal');
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

// ─── Trial Balance ─────────────────────────────────────────────────────────────

router.get('/trial-balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'journal', module: 'gl' });
    const { tenantId } = req.tenantContext!;

    const balances = await req.withTenantDb!(async (tx) => {
      const accounts = await tx.glAccount.findMany({ where: { tenantId, isActive: true } });
      const lines = await tx.glJournalLine.findMany({
        where: { tenantId, journal: { status: 'Posted' } },
      });

      return accounts.map(acc => {
        const accLines = lines.filter(l => l.accountId === acc.id);
        const totalDebit = accLines.reduce((s, l) => s + Number(l.debit), 0);
        const totalCredit = accLines.reduce((s, l) => s + Number(l.credit), 0);
        return { ...acc, totalDebit, totalCredit, balance: totalDebit - totalCredit };
      }).filter(a => a.totalDebit !== 0 || a.totalCredit !== 0);
    });

    sendSuccess(res, balances);
  } catch (e) { next(e); }
});

// ─── Fiscal Periods ───────────────────────────────────────────────────────────

router.get('/periods', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'fiscal_period', module: 'gl' });
    const { tenantId } = req.tenantContext!;

    const periods = await req.withTenantDb!((tx) =>
      tx.fiscalPeriod.findMany({ where: { tenantId }, orderBy: { startDate: 'desc' } }),
    );
    sendSuccess(res, periods);
  } catch (e) { next(e); }
});

router.patch('/periods/:id/lock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'configure', { type: 'fiscal_period', module: 'gl' });
    const { tenantId, actorId } = req.tenantContext!;

    const updated = await req.withTenantDb!(async (tx) => {
      const period = await tx.fiscalPeriod.findFirst({ where: { id: req.params.id, tenantId } });
      if (!period) return null;

      const u = await tx.fiscalPeriod.update({
        where: { id: period.id },
        data: { status: 'Locked', lockedAt: new Date(), lockedBy: actorId },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'lock_period',
        resourceType: 'fiscal_period', resourceId: period.id,
        correlationId: req.correlationId,
      });
      return u;
    });

    if (!updated) return sendNotFound(res, 'Period');
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

export default router;
