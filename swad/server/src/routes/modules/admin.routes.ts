import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { assertCanPerform } from '../../services/permissions.service';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';

const router = Router();
router.use(authenticate, resolveTenantContext);

// ─── Approval Limits ──────────────────────────────────────────────────────────

router.get('/approval-limits', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'approval_limit', module: 'admin' });
    const { tenantId } = req.tenantContext!;
    const limits = await req.withTenantDb!((tx) =>
      tx.approvalLimit.findMany({ where: { tenantId }, orderBy: { module: 'asc' } }),
    );
    sendSuccess(res, limits);
  } catch (err) { next(err); }
});

router.post('/approval-limits', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'approval_limit', module: 'admin' });
    const { tenantId } = req.tenantContext!;
    const body = z.object({
      module: z.string().min(1),
      action: z.string().min(1),
      thresholdAmount: z.number().min(0),
      requiredRoleId: z.string().uuid().optional(),
    }).parse(req.body);

    const limit = await req.withTenantDb!((tx) =>
      tx.approvalLimit.create({ data: { tenantId, ...body } }),
    );
    sendCreated(res, limit);
  } catch (err) { next(err); }
});

router.patch('/approval-limits/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'update', { type: 'approval_limit', module: 'admin' });
    const { tenantId } = req.tenantContext!;
    const body = z.object({
      thresholdAmount: z.number().min(0).optional(),
      requiredRoleId: z.string().uuid().optional(),
    }).parse(req.body);

    const updated = await req.withTenantDb!(async (tx) => {
      const existing = await tx.approvalLimit.findFirst({ where: { id: req.params.id, tenantId } });
      if (!existing) return null;
      return tx.approvalLimit.update({ where: { id: existing.id }, data: body });
    });

    if (!updated) return sendNotFound(res, 'Approval Limit');
    sendSuccess(res, updated);
  } catch (err) { next(err); }
});

// ─── Numbering Sequences ──────────────────────────────────────────────────────

router.get('/numbering', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'numbering_sequence', module: 'admin' });
    const { tenantId } = req.tenantContext!;
    const sequences = await req.withTenantDb!((tx) =>
      tx.numberingSequence.findMany({ where: { tenantId }, orderBy: { documentType: 'asc' } }),
    );
    sendSuccess(res, sequences);
  } catch (err) { next(err); }
});

router.post('/numbering', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'numbering_sequence', module: 'admin' });
    const { tenantId } = req.tenantContext!;
    const body = z.object({
      documentType: z.string().min(1),
      prefix: z.string().min(1),
      nextNumber: z.number().int().positive().default(1),
      padding: z.number().int().min(1).max(10).default(5),
    }).parse(req.body);

    const sequence = await req.withTenantDb!((tx) =>
      tx.numberingSequence.create({ data: { tenantId, ...body } }),
    );
    sendCreated(res, sequence);
  } catch (err) { next(err); }
});

/**
 * Atomically returns the next formatted number for a document type
 * (e.g. "BILL-00042") and increments the counter, all inside one
 * transaction so concurrent requests can't get the same number.
 */
router.post('/numbering/:documentType/next', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'update', { type: 'numbering_sequence', module: 'admin' });
    const { tenantId } = req.tenantContext!;

    const result = await req.withTenantDb!(async (tx) => {
      const seq = await tx.numberingSequence.findFirst({
        where: { tenantId, documentType: req.params.documentType },
      });
      if (!seq) return null;

      const updated = await tx.numberingSequence.update({
        where: { id: seq.id },
        data: { nextNumber: { increment: 1 } },
      });

      const formatted = `${seq.prefix}-${String(seq.nextNumber).padStart(seq.padding, '0')}`;
      return { formatted, nextNumber: updated.nextNumber };
    });

    if (!result) return sendNotFound(res, 'Numbering Sequence');
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

// ─── Module Feature Flags ─────────────────────────────────────────────────────

router.get('/feature-flags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'module_feature_flag', module: 'admin' });
    const { tenantId } = req.tenantContext!;
    const flags = await req.withTenantDb!((tx) =>
      tx.moduleFeatureFlag.findMany({ where: { tenantId }, orderBy: { moduleName: 'asc' } }),
    );
    sendSuccess(res, flags);
  } catch (err) { next(err); }
});

router.patch('/feature-flags/:moduleName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'update', { type: 'module_feature_flag', module: 'admin' });
    const { tenantId } = req.tenantContext!;
    const body = z.object({ isEnabled: z.boolean() }).parse(req.body);

    const flag = await req.withTenantDb!((tx) =>
      tx.moduleFeatureFlag.upsert({
        where: { tenantId_moduleName: { tenantId, moduleName: req.params.moduleName } },
        update: { isEnabled: body.isEnabled },
        create: { tenantId, moduleName: req.params.moduleName, isEnabled: body.isEnabled },
      }),
    );

    if (!flag) throw new AppError(500, 'Could not update feature flag');
    sendSuccess(res, flag);
  } catch (err) { next(err); }
});

export default router;
