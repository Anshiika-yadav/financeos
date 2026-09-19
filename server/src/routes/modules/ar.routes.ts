import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { writeAuditLog } from '../../services/audit.service';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';

const router = Router();
router.use(authenticate, resolveTenantContext);

// ─── Customers ────────────────────────────────────────────────────────────────

router.get('/customers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const customers = await prisma.customer.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
    sendSuccess(res, customers);
  } catch (e) { next(e); }
});

router.post('/customers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      country: z.string().optional(),
      currency: z.string().length(3).default('USD'),
      creditLimit: z.number().min(0).default(0),
      paymentTerms: z.number().int().default(30),
    }).parse(req.body);

    const count = await prisma.customer.count({ where: { tenantId } });
    const code = `CUS-${String(count + 1).padStart(4, '0')}`;
    const customer = await prisma.customer.create({ data: { tenantId, code, ...body } });
    await writeAuditLog({ tenantId, actorId, action: 'create', resourceType: 'customer', resourceId: customer.id, after: customer as never });
    sendCreated(res, customer);
  } catch (e) { next(e); }
});

router.get('/customers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, tenantId },
      include: { invoices: { orderBy: { invoiceDate: 'desc' }, take: 10 } },
    });
    if (!customer) return sendNotFound(res, 'Customer');
    sendSuccess(res, customer);
  } catch (e) { next(e); }
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

router.get('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const cursor = req.query.cursor as string | undefined;
    const status = req.query.status as string | undefined;

    const invoices = await prisma.invoice.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      include: { customer: { select: { name: true, code: true } }, lines: true },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = invoices.length > limit;
    const data = hasMore ? invoices.slice(0, limit) : invoices;
    sendSuccess(res, { data, nextCursor: hasMore ? data[data.length - 1].id : null, hasMore });
  } catch (e) { next(e); }
});

router.get('/invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, tenantId },
      include: { customer: true, lines: true, receipts: true },
    });
    if (!invoice) return sendNotFound(res, 'Invoice');
    sendSuccess(res, invoice);
  } catch (e) { next(e); }
});

router.post('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      customerId: z.string().uuid(),
      reference: z.string().optional(),
      description: z.string().optional(),
      invoiceDate: z.string(),
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

    const count = await prisma.invoice.count({ where: { tenantId } });
    const invoiceNumber = `INV-${String(count + 1).padStart(5, '0')}`;

    const lines = body.lines.map((l, i) => {
      const amount = l.quantity * l.unitPrice;
      return { ...l, lineNumber: i + 1, amount };
    });
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const taxAmount = lines.reduce((s, l) => s + (l.amount * l.taxRate / 100), 0);
    const totalAmount = subtotal + taxAmount;

    const invoice = await prisma.invoice.create({
      data: {
        tenantId, invoiceNumber, customerId: body.customerId,
        reference: body.reference, description: body.description,
        invoiceDate: new Date(body.invoiceDate), dueDate: new Date(body.dueDate),
        currency: body.currency, subtotal, taxAmount, totalAmount,
        lines: { create: lines.map(l => ({ ...l, tenantId })) },
      },
      include: { lines: true, customer: true },
    });

    await writeAuditLog({ tenantId, actorId, action: 'create', resourceType: 'invoice', resourceId: invoice.id, after: invoice as never });
    sendCreated(res, invoice);
  } catch (e) { next(e); }
});

router.patch('/invoices/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, tenantId } });
    if (!invoice) return sendNotFound(res, 'Invoice');
    if (invoice.status !== 'Pending') throw new AppError(422, 'Only Pending invoices can be approved');
    const updated = await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'Approved', approvedBy: actorId, approvedAt: new Date() } });
    await writeAuditLog({ tenantId, actorId, action: 'approve', resourceType: 'invoice', resourceId: invoice.id });
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

// ─── Receipts ─────────────────────────────────────────────────────────────────

router.get('/receipts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const receipts = await prisma.receipt.findMany({
      where: { tenantId },
      include: { customer: { select: { name: true } }, invoice: { select: { invoiceNumber: true } } },
      orderBy: { receiptDate: 'desc' },
    });
    sendSuccess(res, receipts);
  } catch (e) { next(e); }
});

router.post('/receipts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      customerId: z.string().uuid(),
      invoiceId: z.string().uuid().optional(),
      receiptDate: z.string(),
      amount: z.number().positive(),
      currency: z.string().length(3).default('USD'),
      paymentMethod: z.string().default('Bank Transfer'),
      reference: z.string().optional(),
    }).parse(req.body);

    const count = await prisma.receipt.count({ where: { tenantId } });
    const receiptNumber = `REC-${String(count + 1).padStart(5, '0')}`;

    const receipt = await prisma.receipt.create({
      data: { ...body, tenantId, receiptNumber, receiptDate: new Date(body.receiptDate) },
    });

    if (body.invoiceId) {
      const invoice = await prisma.invoice.findFirst({ where: { id: body.invoiceId, tenantId } });
      if (invoice) {
        const newPaid = Number(invoice.amountPaid) + body.amount;
        const status = newPaid >= Number(invoice.totalAmount) ? 'Paid' : 'Partially Paid';
        await prisma.invoice.update({ where: { id: invoice.id }, data: { amountPaid: newPaid, status } });
      }
    }

    await writeAuditLog({ tenantId, actorId, action: 'create', resourceType: 'receipt', resourceId: receipt.id, after: receipt as never });
    sendCreated(res, receipt);
  } catch (e) { next(e); }
});

// ─── AR Ageing ────────────────────────────────────────────────────────────────

router.get('/ageing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const today = new Date();
    const invoices = await prisma.invoice.findMany({
      where: { tenantId, status: { in: ['Posted', 'Partially Paid', 'Approved'] } },
      include: { customer: { select: { name: true, code: true } } },
    });

    const ageing = invoices.map(inv => {
      const outstanding = Number(inv.totalAmount) - Number(inv.amountPaid);
      const daysOverdue = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
      let bucket = 'Current';
      if (daysOverdue > 90) bucket = '90+ days';
      else if (daysOverdue > 60) bucket = '61-90 days';
      else if (daysOverdue > 30) bucket = '31-60 days';
      else if (daysOverdue > 0) bucket = '1-30 days';
      return { ...inv, outstanding, daysOverdue, bucket };
    });

    sendSuccess(res, ageing);
  } catch (e) { next(e); }
});

export default router;
