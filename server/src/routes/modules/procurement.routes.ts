import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { writeAuditLog } from '../../services/audit.service';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';

const router = Router();
router.use(authenticate, resolveTenantContext);

// ─── Purchase Requests ────────────────────────────────────────────────────────

router.get('/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const prs = await prisma.purchaseRequest.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    sendSuccess(res, prs);
  } catch (e) { next(e); }
});

router.post('/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      title: z.string().min(1),
      department: z.string().optional(),
      totalAmount: z.number().min(0),
      currency: z.string().length(3).default('USD'),
      requiredBy: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const count = await prisma.purchaseRequest.count({ where: { tenantId } });
    const prNumber = `PR-${String(count + 1).padStart(5, '0')}`;
    const pr = await prisma.purchaseRequest.create({
      data: { tenantId, prNumber, requestedBy: actorId, ...body, requiredBy: body.requiredBy ? new Date(body.requiredBy) : null },
    });
    await writeAuditLog({ tenantId, actorId, action: 'create', resourceType: 'purchase_request', resourceId: pr.id });
    sendCreated(res, pr);
  } catch (e) { next(e); }
});

router.patch('/requests/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const pr = await prisma.purchaseRequest.findFirst({ where: { id: req.params.id, tenantId } });
    if (!pr) return sendNotFound(res, 'Purchase Request');
    if (pr.status !== 'Pending') throw new AppError(422, 'Only Pending requests can be approved');
    const updated = await prisma.purchaseRequest.update({ where: { id: pr.id }, data: { status: 'Approved', approvedBy: actorId, approvedAt: new Date() } });
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

// ─── Purchase Orders ──────────────────────────────────────────────────────────

router.get('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const pos = await prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, pos);
  } catch (e) { next(e); }
});

router.post('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      purchaseRequestId: z.string().uuid().optional(),
      supplierId: z.string().uuid().optional(),
      title: z.string().min(1),
      orderDate: z.string(),
      deliveryDate: z.string().optional(),
      currency: z.string().length(3).default('USD'),
      notes: z.string().optional(),
      lines: z.array(z.object({
        description: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
      })).min(1),
    }).parse(req.body);

    const count = await prisma.purchaseOrder.count({ where: { tenantId } });
    const poNumber = `PO-${String(count + 1).padStart(5, '0')}`;

    const lines = body.lines.map((l, i) => ({ ...l, lineNumber: i + 1, amount: l.quantity * l.unitPrice }));
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);

    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId, poNumber, title: body.title,
        purchaseRequestId: body.purchaseRequestId,
        supplierId: body.supplierId,
        orderDate: new Date(body.orderDate),
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
        currency: body.currency, subtotal, totalAmount: subtotal,
        lines: { create: lines.map(l => ({ ...l, tenantId, received: 0 })) },
      },
      include: { lines: true },
    });
    await writeAuditLog({ tenantId, actorId, action: 'create', resourceType: 'purchase_order', resourceId: po.id });
    sendCreated(res, po);
  } catch (e) { next(e); }
});

export default router;
