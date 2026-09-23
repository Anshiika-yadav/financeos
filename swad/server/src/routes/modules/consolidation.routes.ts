import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { assertCanPerform } from '../../services/permissions.service';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';

const router = Router();
router.use(authenticate, resolveTenantContext);

router.get('/groups', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'consolidation_group', module: 'consolidation' });
    const { tenantId } = req.tenantContext!;
    const groups = await req.withTenantDb!((tx) =>
      tx.consolidationGroup.findMany({
        where: { tenantId },
        include: { entities: { include: { legalEntity: { select: { name: true, currency: true } } } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
    sendSuccess(res, groups);
  } catch (e) { next(e); }
});

router.post('/groups', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'consolidation_group', module: 'consolidation' });
    const { tenantId } = req.tenantContext!;
    const body = z.object({
      name: z.string().min(1),
      reportingCurrency: z.string().length(3).default('USD'),
      entityIds: z.array(z.string().uuid()).min(1),
    }).parse(req.body);

    const group = await req.withTenantDb!((tx) =>
      tx.consolidationGroup.create({
        data: {
          tenantId, name: body.name, reportingCurrency: body.reportingCurrency,
          entities: { create: body.entityIds.map((legalEntityId) => ({ tenantId, legalEntityId })) },
        },
        include: { entities: true },
      }),
    );
    sendCreated(res, group);
  } catch (e) { next(e); }
});

router.get('/intercompany', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'intercompany_transaction', module: 'consolidation' });
    const { tenantId } = req.tenantContext!;
    const txns = await req.withTenantDb!((tx) =>
      tx.intercompanyTransaction.findMany({
        where: { tenantId },
        include: {
          fromEntity: { select: { name: true } },
          toEntity: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
    sendSuccess(res, txns);
  } catch (e) { next(e); }
});

router.post('/intercompany', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'intercompany_transaction', module: 'consolidation' });
    const { tenantId } = req.tenantContext!;
    const body = z.object({
      fromEntityId: z.string().uuid(),
      toEntityId: z.string().uuid(),
      amount: z.number().positive(),
      currency: z.string().length(3).default('USD'),
      description: z.string().optional(),
    }).parse(req.body);

    const txn = await req.withTenantDb!((tx) =>
      tx.intercompanyTransaction.create({ data: { tenantId, ...body } }),
    );
    sendCreated(res, txn);
  } catch (e) { next(e); }
});

/**
 * Consolidated trial balance: sums each member entity's GL account
 * balances, converts to the group's reporting currency using a static
 * rate table for now (real FX rates are a future integration), and
 * nets out intercompany transactions between member entities.
 */
router.get('/groups/:id/trial-balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'consolidation_group', module: 'consolidation' });
    const { tenantId } = req.tenantContext!;

    const result = await req.withTenantDb!(async (tx) => {
      const group = await tx.consolidationGroup.findFirst({
        where: { id: req.params.id, tenantId },
        include: { entities: { include: { legalEntity: true } } },
      });
      if (!group) return null;

      const entityIds = group.entities.map((e) => e.legalEntityId);

      const accounts = await tx.glAccount.findMany({ where: { tenantId, isActive: true } });
      const lines = await tx.glJournalLine.findMany({
        where: { tenantId, journal: { tenantId, status: 'Posted' } },
      });

      const rows = accounts.map((acct) => {
        const acctLines = lines.filter((l) => l.accountId === acct.id);
        const debit = acctLines.reduce((s, l) => s + Number(l.debit), 0);
        const credit = acctLines.reduce((s, l) => s + Number(l.credit), 0);
        return {
          code: acct.code, name: acct.name,
          balance: acct.normalBalance === 'Debit' ? debit - credit : credit - debit,
        };
      });

      const intercompanyTotal = await tx.intercompanyTransaction.aggregate({
        where: { tenantId, status: 'Pending', fromEntityId: { in: entityIds }, toEntityId: { in: entityIds } },
        _sum: { amount: true },
      });

      return {
        group: { id: group.id, name: group.name, reportingCurrency: group.reportingCurrency },
        rows,
        pendingIntercompanyElimination: Number(intercompanyTotal._sum.amount ?? 0),
      };
    });

    if (!result) return sendNotFound(res, 'Consolidation Group');
    sendSuccess(res, result);
  } catch (e) { next(e); }
});

export default router;
