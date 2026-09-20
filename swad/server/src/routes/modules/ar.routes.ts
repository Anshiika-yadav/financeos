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

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const createCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().length(3).default('USD'),
  creditLimit: z.number().min(0).default(0),
  paymentTerms: z.number().int().default(30),
});

const createInvoiceSchema = z.object({
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
});

const createReceiptSchema = z.object({
  customerId: z.string().uuid(),
  invoiceId: z.string().uuid().optional(),
  receiptDate: z.string(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  paymentMethod: z.string().default('Bank Transfer'),
  reference: z.string().optional(),
});

// ─── Customers ────────────────────────────────────────────────────────────────

router.get('/customers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'invoice', module: 'ar' });
    const { tenantId } = req.tenantContext!;

    const customers = await req.withTenantDb!((tx) =>
      tx.customer.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    );
    sendSuccess(res, customers);
  } catch (e) { next(e); }
});

router.post('/customers', requireIdempotencyKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'invoice', module: 'ar' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = createCustomerSchema.parse(req.body);

    const customer = await req.withTenantDb!(async (tx) => {
      const count = await tx.customer.count({ where: { tenantId } });
      const code = `CUS-${String(count + 1).padStart(4, '0')}`;
      const c = await tx.customer.create({ data: { tenantId, code, ...body } });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'create',
        resourceType: 'customer', resourceId: c.id,
        after: c as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return c;
    });

    sendCreated(res, customer);
  } catch (e) { next(e); }
});

router.get('/customers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'invoice', module: 'ar' });
    const { tenantId } = req.tenantContext!;

    const customer = await req.withTenantDb!((tx) =>
      tx.customer.findFirst({
        where: { id: req.params.id, tenantId },
        include: { invoices: { orderBy: { invoiceDate: 'desc' }, take: 10 } },
      }),
    );
    if (!customer) return sendNotFound(res, 'Customer');
    sendSuccess(res, customer);
  } catch (e) { next(e); }
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

router.get('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'invoice', module: 'ar' });
    const { tenantId } = req.tenantContext!;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const cursor = req.query.cursor as string | undefined;
    const status = req.query.status as string | undefined;

    const invoices = await req.withTenantDb!((tx) =>
      tx.invoice.findMany({
        where: { tenantId, ...(status ? { status } : {}) },
        include: { customer: { select: { name: true, code: true } }, lines: true },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    );

    const hasMore = invoices.length > limit;
    const data = hasMore ? invoices.slice(0, limit) : invoices;
    sendSuccess(res, { data, nextCursor: hasMore ? data[data.length - 1].id : null, hasMore });
  } catch (e) { next(e); }
});

router.get('/invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'invoice', module: 'ar' });
    const { tenantId } = req.tenantContext!;

    const invoice = await req.withTenantDb!((tx) =>
      tx.invoice.findFirst({
        where: { id: req.params.id, tenantId },
        include: { customer: true, lines: true, receipts: true },
      }),
    );
    if (!invoice) return sendNotFound(res, 'Invoice');
    sendSuccess(res, invoice);
  } catch (e) { next(e); }
});

router.post('/invoices', requireIdempotencyKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'invoice', module: 'ar' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = createInvoiceSchema.parse(req.body);

    const lineData = body.lines.map((l, i) => {
      const amount = l.quantity * l.unitPrice;
      return { ...l, lineNumber: i + 1, amount };
    });
    const subtotal = lineData.reduce((s, l) => s + l.amount, 0);
    const taxAmount = lineData.reduce((s, l) => s + (l.amount * l.taxRate / 100), 0);
    const totalAmount = subtotal + taxAmount;

    const invoice = await req.withTenantDb!(async (tx) => {
      const count = await tx.invoice.count({ where: { tenantId } });
      const invoiceNumber = `INV-${String(count + 1).padStart(5, '0')}`;

      const inv = await tx.invoice.create({
        data: {
          tenantId, invoiceNumber,
          customerId: body.customerId,
          reference: body.reference,
          description: body.description,
          invoiceDate: new Date(body.invoiceDate),
          dueDate: new Date(body.dueDate),
          currency: body.currency, subtotal, taxAmount, totalAmount,
          lines: { create: lineData.map(l => ({ ...l, tenantId })) },
        },
        include: { lines: true, customer: true },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'create',
        resourceType: 'invoice', resourceId: inv.id,
        after: inv as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return inv;
    });

    sendCreated(res, invoice);
  } catch (e) { next(e); }
});

router.patch('/invoices/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'approve', { type: 'invoice', module: 'ar' });
    const { tenantId, actorId } = req.tenantContext!;

    const updated = await req.withTenantDb!(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id: req.params.id, tenantId } });
      if (!invoice) return null;
      if (invoice.status !== 'Pending') throw new AppError(422, 'Only Pending invoices can be approved');
      const u = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'Approved', approvedBy: actorId, approvedAt: new Date() },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'approve',
        resourceType: 'invoice', resourceId: invoice.id,
        before: invoice as unknown as Record<string, unknown>,
        after: u as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return u;
    });

    if (!updated) return sendNotFound(res, 'Invoice');
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

// ─── Receipts ─────────────────────────────────────────────────────────────────

router.get('/receipts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'receipt', module: 'ar' });
    const { tenantId } = req.tenantContext!;

    const receipts = await req.withTenantDb!((tx) =>
      tx.receipt.findMany({
        where: { tenantId },
        include: {
          customer: { select: { name: true } },
          invoice: { select: { invoiceNumber: true } },
        },
        orderBy: { receiptDate: 'desc' },
      }),
    );
    sendSuccess(res, receipts);
  } catch (e) { next(e); }
});

router.post('/receipts', requireIdempotencyKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'receipt', module: 'ar' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = createReceiptSchema.parse(req.body);

    const receipt = await req.withTenantDb!(async (tx) => {
      const count = await tx.receipt.count({ where: { tenantId } });
      const receiptNumber = `REC-${String(count + 1).padStart(5, '0')}`;

      const r = await tx.receipt.create({
        data: {
          tenantId, receiptNumber,
          customerId: body.customerId,
          invoiceId: body.invoiceId,
          receiptDate: new Date(body.receiptDate),
          amount: body.amount,
          currency: body.currency,
          paymentMethod: body.paymentMethod,
          reference: body.reference,
        },
      });

      // Allocate to invoice in the same transaction
      if (body.invoiceId) {
        const invoice = await tx.invoice.findFirst({ where: { id: body.invoiceId, tenantId } });
        if (invoice) {
          const newPaid = Number(invoice.amountPaid) + body.amount;
          const status = newPaid >= Number(invoice.totalAmount) ? 'Paid' : 'Partially Paid';
          await tx.invoice.update({ where: { id: invoice.id }, data: { amountPaid: newPaid, status } });
        }
      }

      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'create',
        resourceType: 'receipt', resourceId: r.id,
        after: r as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return r;
    });

    sendCreated(res, receipt);
  } catch (e) { next(e); }
});

// ─── AR Ageing ────────────────────────────────────────────────────────────────

router.get('/ageing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'invoice', module: 'ar' });
    const { tenantId } = req.tenantContext!;
    const today = new Date();

    const invoices = await req.withTenantDb!((tx) =>
      tx.invoice.findMany({
        where: { tenantId, status: { in: ['Posted', 'Partially Paid', 'Approved'] } },
        include: { customer: { select: { name: true, code: true } } },
      }),
    );

    const ageing = invoices.map(inv => {
      const outstanding = Number(inv.totalAmount) - Number(inv.amountPaid);
      const daysOverdue = Math.floor(
        (today.getTime() - new Date(inv.dueDate).getTime()) / 86400000,
      );
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
