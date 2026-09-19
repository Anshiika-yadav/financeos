import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { writeAuditLog } from '../../services/audit.service';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';

const router = Router();
router.use(authenticate, resolveTenantContext);

// ─── Suppliers ────────────────────────────────────────────────────────────────

router.get('/suppliers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, suppliers);
  } catch (e) { next(e); }
});

router.post('/suppliers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      country: z.string().optional(),
      currency: z.string().length(3).default('USD'),
      taxId: z.string().optional(),
      paymentTerms: z.number().int().default(30),
    }).parse(req.body);

    const count = await prisma.supplier.count({ where: { tenantId } });
    const code = `SUP-${String(count + 1).padStart(4, '0')}`;
    const supplier = await prisma.supplier.create({ data: { tenantId, code, ...body } });
    await writeAuditLog({ tenantId, actorId, action: 'create', resourceType: 'supplier', resourceId: supplier.id, after: supplier as never });
    sendCreated(res, supplier);
  } catch (e) { next(e); }
});

router.get('/suppliers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, tenantId },
      include: { bills: { orderBy: { billDate: 'desc' }, take: 10 } },
    });
    if (!supplier) return sendNotFound(res, 'Supplier');
    sendSuccess(res, supplier);
  } catch (e) { next(e); }
});

// ─── Bills ────────────────────────────────────────────────────────────────────

router.get('/bills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const cursor = req.query.cursor as string | undefined;
    const status = req.query.status as string | undefined;

    const bills = await prisma.bill.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      include: { supplier: { select: { name: true, code: true } }, lines: true },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = bills.length > limit;
    const data = hasMore ? bills.slice(0, limit) : bills;
    sendSuccess(res, { data, nextCursor: hasMore ? data[data.length - 1].id : null, hasMore });
  } catch (e) { next(e); }
});

router.get('/bills/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const bill = await prisma.bill.findFirst({
      where: { id: req.params.id, tenantId },
      include: { supplier: true, lines: true },
    });
    if (!bill) return sendNotFound(res, 'Bill');
    sendSuccess(res, bill);
  } catch (e) { next(e); }
});

router.post('/bills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      supplierId: z.string().uuid(),
      reference: z.string().optional(),
      description: z.string().optional(),
      billDate: z.string(),
      dueDate: z.string(),
      currency: z.string().length(3).default('USD'),
      lines: z.array(z.object({
        description: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
        taxRate: z.number().min(0).max(100).default(0),
        accountId: z.string().uuid().optional(),
      })).min(1),
    }).parse(req.body);

    const count = await prisma.bill.count({ where: { tenantId } });
    const billNumber = `BILL-${String(count + 1).padStart(5, '0')}`;

    const lines = body.lines.map((l, i) => {
      const amount = l.quantity * l.unitPrice;
      return { ...l, lineNumber: i + 1, amount };
    });
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const taxAmount = lines.reduce((s, l) => s + (l.amount * l.taxRate / 100), 0);
    const totalAmount = subtotal + taxAmount;

    const bill = await prisma.bill.create({
      data: {
        tenantId, billNumber, supplierId: body.supplierId,
        reference: body.reference, description: body.description,
        billDate: new Date(body.billDate), dueDate: new Date(body.dueDate),
        currency: body.currency, subtotal, taxAmount, totalAmount,
        lines: { create: lines.map(l => ({ ...l, tenantId })) },
      },
      include: { lines: true, supplier: true },
    });

    await writeAuditLog({ tenantId, actorId, action: 'create', resourceType: 'bill', resourceId: bill.id, after: bill as never });
    sendCreated(res, bill);
  } catch (e) { next(e); }
});

router.patch('/bills/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const bill = await prisma.bill.findFirst({ where: { id: req.params.id, tenantId } });
    if (!bill) return sendNotFound(res, 'Bill');
    if (bill.status !== 'Draft') throw new AppError(422, 'Only Draft bills can be submitted');
    const updated = await prisma.bill.update({ where: { id: bill.id }, data: { status: 'Pending' } });
    await writeAuditLog({ tenantId, actorId, action: 'submit', resourceType: 'bill', resourceId: bill.id, before: bill as never, after: updated as never });
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

router.patch('/bills/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const bill = await prisma.bill.findFirst({ where: { id: req.params.id, tenantId } });
    if (!bill) return sendNotFound(res, 'Bill');
    if (bill.status !== 'Pending') throw new AppError(422, 'Only Pending bills can be approved');
    const updated = await prisma.bill.update({ where: { id: bill.id }, data: { status: 'Approved', approvedBy: actorId, approvedAt: new Date() } });
    await writeAuditLog({ tenantId, actorId, action: 'approve', resourceType: 'bill', resourceId: bill.id });
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

// ─── Payment Runs ─────────────────────────────────────────────────────────────

router.get('/payment-runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const runs = await prisma.paymentRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, runs);
  } catch (e) { next(e); }
});

router.post('/payment-runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      description: z.string().optional(),
      paymentDate: z.string(),
      billIds: z.array(z.string().uuid()).min(1),
      currency: z.string().length(3).default('USD'),
    }).parse(req.body);

    const bills = await prisma.bill.findMany({ where: { id: { in: body.billIds }, tenantId, status: 'Approved' } });
    if (bills.length === 0) throw new AppError(422, 'No approved bills found for the provided IDs');

    const totalAmount = bills.reduce((s, b) => s + Number(b.totalAmount) - Number(b.amountPaid), 0);
    const count = await prisma.paymentRun.count({ where: { tenantId } });
    const runNumber = `PAY-${String(count + 1).padStart(5, '0')}`;

    const run = await prisma.paymentRun.create({
      data: {
        tenantId, runNumber, paymentDate: new Date(body.paymentDate),
        description: body.description, currency: body.currency,
        totalAmount, billIds: body.billIds,
      },
    });

    await writeAuditLog({ tenantId, actorId, action: 'create', resourceType: 'payment_run', resourceId: run.id, after: run as never });
    sendCreated(res, run);
  } catch (e) { next(e); }
});

router.patch('/payment-runs/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const run = await prisma.paymentRun.findFirst({ where: { id: req.params.id, tenantId } });
    if (!run) return sendNotFound(res, 'Payment Run');
    const updated = await prisma.paymentRun.update({ where: { id: run.id }, data: { status: 'Approved', approvedBy: actorId, approvedAt: new Date() } });
    await writeAuditLog({ tenantId, actorId, action: 'approve', resourceType: 'payment_run', resourceId: run.id });
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

export default router;
