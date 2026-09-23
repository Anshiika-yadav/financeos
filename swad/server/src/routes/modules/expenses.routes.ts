import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { writeAuditLogTx } from '../../services/audit.service';
import { assertCanPerform } from '../../services/permissions.service';
import { requireIdempotencyKey } from '../../middleware/idempotency';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';

const router = Router();
router.use(authenticate, resolveTenantContext);

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createClaimSchema = z.object({
  description: z.string().min(1),
  claimDate: z.string(),
  currency: z.string().length(3).default('USD'),
  lines: z.array(z.object({
    category: z.string(),
    description: z.string(),
    expenseDate: z.string(),
    amount: z.number().positive(),
    currency: z.string().length(3).default('USD'),
  })).min(1),
});

// ─── Claims ───────────────────────────────────────────────────────────────────

router.get('/claims', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'expense', module: 'expenses' });
    const { tenantId } = req.tenantContext!;
    const claims = await req.withTenantDb!((tx) =>
      tx.expenseClaim.findMany({
        where: { tenantId },
        include: { lines: true },
        orderBy: { claimDate: 'desc' },
      }),
    );
    sendSuccess(res, claims);
  } catch (e) { next(e); }
});

router.get('/claims/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'expense', module: 'expenses' });
    const { tenantId } = req.tenantContext!;
    const claim = await req.withTenantDb!((tx) =>
      tx.expenseClaim.findFirst({
        where: { id: req.params.id, tenantId },
        include: { lines: true },
      }),
    );
    if (!claim) return sendNotFound(res, 'Expense Claim');
    sendSuccess(res, claim);
  } catch (e) { next(e); }
});

router.post('/claims', requireIdempotencyKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'expense', module: 'expenses' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = createClaimSchema.parse(req.body);
    const totalAmount = body.lines.reduce((s, l) => s + l.amount, 0);

    const claim = await req.withTenantDb!(async (tx) => {
      const count = await tx.expenseClaim.count({ where: { tenantId } });
      const claimNumber = `EXP-${String(count + 1).padStart(5, '0')}`;

      const c = await tx.expenseClaim.create({
        data: {
          tenantId, claimNumber, submittedBy: actorId,
          description: body.description,
          claimDate: new Date(body.claimDate),
          currency: body.currency, totalAmount,
          lines: {
            create: body.lines.map((l) => ({
              ...l, tenantId, expenseDate: new Date(l.expenseDate),
            })),
          },
        },
        include: { lines: true },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'create',
        resourceType: 'expense', resourceId: c.id,
        after: c as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return c;
    });
    sendCreated(res, claim);
  } catch (e) { next(e); }
});

router.patch('/claims/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'update', { type: 'expense', module: 'expenses' });
    const { tenantId, actorId } = req.tenantContext!;

    const updated = await req.withTenantDb!(async (tx) => {
      const claim = await tx.expenseClaim.findFirst({ where: { id: req.params.id, tenantId } });
      if (!claim) return null;
      if (claim.status !== 'Draft') throw new AppError(422, 'Only Draft claims can be submitted');
      const u = await tx.expenseClaim.update({ where: { id: claim.id }, data: { status: 'Pending' } });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'submit',
        resourceType: 'expense', resourceId: claim.id,
        before: claim as unknown as Record<string, unknown>,
        after: u as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return u;
    });
    if (!updated) return sendNotFound(res, 'Expense Claim');
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

router.patch('/claims/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'approve', { type: 'expense', module: 'expenses' });
    const { tenantId, actorId } = req.tenantContext!;

    const updated = await req.withTenantDb!(async (tx) => {
      const claim = await tx.expenseClaim.findFirst({ where: { id: req.params.id, tenantId } });
      if (!claim) return null;
      if (claim.status !== 'Pending') throw new AppError(422, 'Only Pending claims can be approved');
      const u = await tx.expenseClaim.update({
        where: { id: claim.id },
        data: { status: 'Approved', approvedBy: actorId, approvedAt: new Date() },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'approve',
        resourceType: 'expense', resourceId: claim.id,
        before: claim as unknown as Record<string, unknown>,
        after: u as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return u;
    });
    if (!updated) return sendNotFound(res, 'Expense Claim');
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

export default router;
