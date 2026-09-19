import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';

const router = Router();
router.use(authenticate, resolveTenantContext);

router.get('/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const items = await prisma.inventoryItem.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
    sendSuccess(res, items);
  } catch (e) { next(e); }
});

router.post('/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
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
    const item = await prisma.inventoryItem.create({ data: { tenantId, ...body } });
    sendCreated(res, item);
  } catch (e) { next(e); }
});

router.get('/movements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const movements = await prisma.stockMovement.findMany({
      where: { tenantId },
      include: { item: { select: { name: true, sku: true } } },
      orderBy: { movementDate: 'desc' },
      take: 100,
    });
    sendSuccess(res, movements);
  } catch (e) { next(e); }
});

router.post('/movements', async (req: Request, res: Response, next: NextFunction) => {
  try {
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
    const movement = await prisma.stockMovement.create({
      data: { tenantId, ...body, totalCost, movementDate: new Date(body.movementDate) },
    });

    const qtyChange = ['Receipt', 'Transfer'].includes(body.movementType) ? body.quantity : -body.quantity;
    await prisma.inventoryItem.update({ where: { id: body.itemId }, data: { quantityOnHand: { increment: qtyChange } } });

    sendCreated(res, movement);
  } catch (e) { next(e); }
});

export default router;
