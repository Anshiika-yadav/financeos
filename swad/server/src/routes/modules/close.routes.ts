import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { assertCanPerform } from '../../services/permissions.service';
import { writeAuditLogTx } from '../../services/audit.service';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';

const router = Router();
router.use(authenticate, resolveTenantContext);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'close_checklist', module: 'close' });
    const { tenantId } = req.tenantContext!;
    const checklists = await req.withTenantDb!((tx) =>
      tx.closeChecklist.findMany({
        where: { tenantId },
        include: { tasks: true, fiscalPeriod: { select: { name: true, status: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
    sendSuccess(res, checklists);
  } catch (e) { next(e); }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'close_checklist', module: 'close' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      fiscalPeriodId: z.string().uuid(),
      taskNames: z.array(z.string().min(1)).default([
        'Reconcile bank accounts',
        'Review AP subledger vs GL',
        'Review AR subledger vs GL',
        'Post depreciation',
        'Review accruals',
        'Lock fiscal period',
      ]),
    }).parse(req.body);

    const checklist = await req.withTenantDb!(async (tx) => {
      const period = await tx.fiscalPeriod.findFirst({ where: { id: body.fiscalPeriodId, tenantId } });
      if (!period) return null;

      const created = await tx.closeChecklist.create({
        data: {
          tenantId, fiscalPeriodId: period.id,
          tasks: { create: body.taskNames.map((name) => ({ tenantId, name })) },
        },
        include: { tasks: true },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'create', resourceType: 'close_checklist',
        resourceId: created.id, correlationId: req.correlationId,
      });
      return created;
    });

    if (!checklist) return sendNotFound(res, 'Fiscal Period');
    sendCreated(res, checklist);
  } catch (e) { next(e); }
});

router.patch('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'update', { type: 'close_task', module: 'close' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      status: z.enum(['Pending', 'Complete']).optional(),
      assigneeId: z.string().uuid().optional(),
    }).parse(req.body);

    const updated = await req.withTenantDb!(async (tx) => {
      const task = await tx.closeTask.findFirst({ where: { id: req.params.id, tenantId } });
      if (!task) return null;
      const result = await tx.closeTask.update({
        where: { id: task.id },
        data: {
          ...body,
          completedAt: body.status === 'Complete' ? new Date() : task.completedAt,
        },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'update', resourceType: 'close_task',
        resourceId: task.id, after: body, correlationId: req.correlationId,
      });
      return result;
    });

    if (!updated) return sendNotFound(res, 'Close Task');
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

/**
 * Attempt to close a period — only succeeds if every task on the
 * checklist is Complete AND the underlying fiscal period is Locked.
 */
router.post('/:id/close', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'approve', { type: 'close_checklist', module: 'close' });
    const { tenantId, actorId } = req.tenantContext!;

    const result = await req.withTenantDb!(async (tx) => {
      const checklist = await tx.closeChecklist.findFirst({
        where: { id: req.params.id, tenantId },
        include: { tasks: true, fiscalPeriod: true },
      });
      if (!checklist) return { notFound: true, checklist: null };

      const blockingTasks = checklist.tasks.filter((t) => t.status !== 'Complete');
      const periodLocked = checklist.fiscalPeriod.status === 'Locked';

      if (blockingTasks.length > 0 || !periodLocked) {
        throw new AppError(409, 'Cannot close: period not ready', 'CLOSE_BLOCKED');
      }

      const updated = await tx.closeChecklist.update({
        where: { id: checklist.id },
        data: { status: 'Closed' },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'close', resourceType: 'close_checklist',
        resourceId: checklist.id, correlationId: req.correlationId,
      });
      return { notFound: false, checklist: updated };
    });

    if (result.notFound) return sendNotFound(res, 'Close Checklist');
    sendSuccess(res, result.checklist);
  } catch (e) { next(e); }
});

export default router;
