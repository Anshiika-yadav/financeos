import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { writeAuditLogTx } from '../../services/audit.service';
import { assertCanPerform } from '../../services/permissions.service';
import { requireIdempotencyKey } from '../../middleware/idempotency';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';

const router = Router();
router.use(authenticate, resolveTenantContext);

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createItemSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional(),
  unit: z.string().default('Each'),
  costMethod: z.string().default('FIFO'),
  unitCost: z.number().positive(),
  reorderPoint: z.number().min(0).default(0),
  warehouseLocation: z.string().optional(),
});

const createMovementSchema = z.object({
  itemId: z.string().uuid(),
  movementType: z.enum(['Receipt', 'Issue', 'Transfer', 'Adjustment']),
  quantity: z.number(),
  unitCost: z.number().positive(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  movementDate: z.string(),
});

// ─── Items ────────────────────────────────────────────────────────────────────

router.get('/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'inventory', module: 'inventory' });
    const { tenantId } = req.tenantContext!;
    const items = await req.withTenantDb!((tx) =>
      tx.inventoryItem.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    );
    sendSuccess(res, items);
  } catch (e) { next(e); }
});

router.post('/items', requireIdempotencyKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'inventory', module: 'inventory' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = createItemSchema.parse(req.body);

    const item = await req.withTenantDb!(async (tx) => {
      const i = await tx.inventoryItem.create({ data: { tenantId, ...body } });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'create',
        resourceType: 'inventory', resourceId: i.id,
        after: i as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return i;
    });
    sendCreated(res, item);
  } catch (e) { next(e); }
});

// ─── Stock movements ──────────────────────────────────────────────────────────

router.get('/movements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'inventory', module: 'inventory' });
    const { tenantId } = req.tenantContext!;
    const movements = await req.withTenantDb!((tx) =>
      tx.stockMovement.findMany({
        where: { tenantId },
        include: { item: { select: { name: true, sku: true } } },
        orderBy: { movementDate: 'desc' },
        take: 100,
      }),
    );
    sendSuccess(res, movements);
  } catch (e) { next(e); }
});

router.post('/movements', requireIdempotencyKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'inventory', module: 'inventory' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = createMovementSchema.parse(req.body);

    const movement = await req.withTenantDb!(async (tx) => {
      const totalCost = Math.abs(body.quantity) * body.unitCost;
      const m = await tx.stockMovement.create({
        data: { tenantId, ...body, totalCost, movementDate: new Date(body.movementDate) },
      });
      // Update quantity on hand in same transaction
      const qtyChange = ['Receipt', 'Transfer'].includes(body.movementType)
        ? body.quantity
        : -body.quantity;
      await tx.inventoryItem.update({
        where: { id: body.itemId },
        data: { quantityOnHand: { increment: qtyChange } },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'create',
        resourceType: 'inventory', resourceId: m.id,
        after: m as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return m;
    });
    sendCreated(res, movement);
  } catch (e) { next(e); }
});

export default router;
