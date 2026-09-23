import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { assertCanPerform } from '../../services/permissions.service';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';

const router = Router();
router.use(authenticate, resolveTenantContext);

// ─── Trial Balance ────────────────────────────────────────────────────────────

router.get('/trial-balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'report', module: 'reports' });
    const { tenantId } = req.tenantContext!;
    const asOf = req.query.asOf ? new Date(req.query.asOf as string) : new Date();

    const rows = await req.withTenantDb!(async (tx) => {
      const accounts = await tx.glAccount.findMany({ where: { tenantId, isActive: true } });
      const lines = await tx.glJournalLine.findMany({
        where: {
          tenantId,
          journal: { tenantId, status: 'Posted', journalDate: { lte: asOf } },
        },
      });

      return accounts.map((acct) => {
        const acctLines = lines.filter((l) => l.accountId === acct.id);
        const debit = acctLines.reduce((s, l) => s + Number(l.debit), 0);
        const credit = acctLines.reduce((s, l) => s + Number(l.credit), 0);
        return {
          accountId: acct.id,
          code: acct.code,
          name: acct.name,
          accountType: acct.accountType,
          debit,
          credit,
          balance: acct.normalBalance === 'Debit' ? debit - credit : credit - debit,
        };
      });
    });

    sendSuccess(res, { asOf, rows });
  } catch (err) { next(err); }
});

// ─── Profit & Loss ────────────────────────────────────────────────────────────

router.get('/profit-and-loss', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'report', module: 'reports' });
    const { tenantId } = req.tenantContext!;
    const from = new Date(req.query.from as string);
    const to = new Date(req.query.to as string);

    const result = await req.withTenantDb!(async (tx) => {
      const accounts = await tx.glAccount.findMany({
        where: { tenantId, isActive: true, accountType: { in: ['Revenue', 'Expense'] } },
      });
      const lines = await tx.glJournalLine.findMany({
        where: {
          tenantId,
          journal: { tenantId, status: 'Posted', journalDate: { gte: from, lte: to } },
        },
      });

      const rows = accounts.map((acct) => {
        const acctLines = lines.filter((l) => l.accountId === acct.id);
        const debit = acctLines.reduce((s, l) => s + Number(l.debit), 0);
        const credit = acctLines.reduce((s, l) => s + Number(l.credit), 0);
        const amount = acct.accountType === 'Revenue' ? credit - debit : debit - credit;
        return { accountId: acct.id, code: acct.code, name: acct.name, accountType: acct.accountType, amount };
      });

      const totalRevenue = rows.filter((r) => r.accountType === 'Revenue').reduce((s, r) => s + r.amount, 0);
      const totalExpense = rows.filter((r) => r.accountType === 'Expense').reduce((s, r) => s + r.amount, 0);

      return { rows, totalRevenue, totalExpense, netIncome: totalRevenue - totalExpense };
    });

    sendSuccess(res, { from, to, ...result });
  } catch (err) { next(err); }
});

// ─── Balance Sheet ────────────────────────────────────────────────────────────

router.get('/balance-sheet', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'report', module: 'reports' });
    const { tenantId } = req.tenantContext!;
    const asOf = req.query.asOf ? new Date(req.query.asOf as string) : new Date();

    const result = await req.withTenantDb!(async (tx) => {
      const accounts = await tx.glAccount.findMany({
        where: { tenantId, isActive: true, accountType: { in: ['Asset', 'Liability', 'Equity'] } },
      });
      const lines = await tx.glJournalLine.findMany({
        where: {
          tenantId,
          journal: { tenantId, status: 'Posted', journalDate: { lte: asOf } },
        },
      });

      const rows = accounts.map((acct) => {
        const acctLines = lines.filter((l) => l.accountId === acct.id);
        const debit = acctLines.reduce((s, l) => s + Number(l.debit), 0);
        const credit = acctLines.reduce((s, l) => s + Number(l.credit), 0);
        const balance = acct.normalBalance === 'Debit' ? debit - credit : credit - debit;
        return { accountId: acct.id, code: acct.code, name: acct.name, accountType: acct.accountType, balance };
      });

      const totalAssets = rows.filter((r) => r.accountType === 'Asset').reduce((s, r) => s + r.balance, 0);
      const totalLiabilities = rows.filter((r) => r.accountType === 'Liability').reduce((s, r) => s + r.balance, 0);
      const totalEquity = rows.filter((r) => r.accountType === 'Equity').reduce((s, r) => s + r.balance, 0);

      return { rows, totalAssets, totalLiabilities, totalEquity };
    });

    sendSuccess(res, { asOf, ...result });
  } catch (err) { next(err); }
});

// ─── Saved Report Views ───────────────────────────────────────────────────────

router.get('/saved-views', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'saved_report_view', module: 'reports' });
    const { tenantId } = req.tenantContext!;
    const views = await req.withTenantDb!((tx) =>
      tx.savedReportView.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
    );
    sendSuccess(res, views);
  } catch (err) { next(err); }
});

router.post('/saved-views', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'saved_report_view', module: 'reports' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      name: z.string().min(1),
      reportType: z.enum(['trial_balance', 'profit_and_loss', 'balance_sheet']),
      filters: z.record(z.unknown()).optional(),
    }).parse(req.body);

    const view = await req.withTenantDb!((tx) =>
      tx.savedReportView.create({
        data: {
          tenantId, name: body.name, reportType: body.reportType,
          filtersJson: body.filters ?? {}, ownerId: actorId,
        },
      }),
    );
    sendCreated(res, view);
  } catch (err) { next(err); }
});

router.delete('/saved-views/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'delete', { type: 'saved_report_view', module: 'reports' });
    const { tenantId } = req.tenantContext!;

    const deleted = await req.withTenantDb!(async (tx) => {
      const view = await tx.savedReportView.findFirst({ where: { id: req.params.id, tenantId } });
      if (!view) return null;
      await tx.savedReportView.delete({ where: { id: view.id } });
      return view;
    });

    if (!deleted) return sendNotFound(res, 'Saved Report View');
    sendSuccess(res, { deleted: true });
  } catch (err) { next(err); }
});

export default router;
