import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { assertCanPerform } from '../../services/permissions.service';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';

const router = Router();
router.use(authenticate, resolveTenantContext);

router.get('/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'inventory_item', module: 'inventory' });
    const { tenantId } = req.tenantContext!;
    const items = await req.withTenantDb!((tx) =>
      tx.inventoryItem.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    );
    sendSuccess(res, items);
  } catch (e) { next(e); }
});

router.post('/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'inventory_item', module: 'inventory' });
    const { tenantId } = req.tenantContext!;
    const body = z.object({
      sku: z.string().min(1),
      name: z.string().min(1),
      category: z.string().optional(),
      unit: z.string().default('Each'),
      costMethod: z.string().default('FIFO'),
      unitCost: z.number().positive(),
      reorderPoint: z.number().min(0).default(0),
      warehouseLocation: z.string().optional(),
    }).parse(req.body);
    const item = await req.withTenantDb!((tx) =>
      tx.inventoryItem.create({ data: { tenantId, ...body } }),
    );
    sendCreated(res, item);
  } catch (e) { next(e); }
});

router.get('/movements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'stock_movement', module: 'inventory' });
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

router.post('/movements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'stock_movement', module: 'inventory' });
    const { tenantId } = req.tenantContext!;
    const body = z.object({
      itemId: z.string().uuid(),
      movementType: z.enum(['Receipt', 'Issue', 'Transfer', 'Adjustment']),
      quantity: z.number(),
      unitCost: z.number().positive(),
      reference: z.string().optional(),
      notes: z.string().optional(),
      movementDate: z.string(),
    }).parse(req.body);

    const totalCost = Math.abs(body.quantity) * body.unitCost;

    const movement = await req.withTenantDb!(async (tx) => {
      // Verify the item belongs to this tenant before mutating it —
      // the original code updated by itemId alone with no tenant check.
      const item = await tx.inventoryItem.findFirst({ where: { id: body.itemId, tenantId } });
      if (!item) return null;

      const created = await tx.stockMovement.create({
        data: { tenantId, ...body, totalCost, movementDate: new Date(body.movementDate) },
      });

      const qtyChange = ['Receipt', 'Transfer'].includes(body.movementType) ? body.quantity : -body.quantity;
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { quantityOnHand: { increment: qtyChange } },
      });

      return created;
    });

    if (!movement) return sendNotFound(res, 'Inventory Item');
    sendCreated(res, movement);
  } catch (e) { next(e); }
});

export default router;
