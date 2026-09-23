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

const createSupplierSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().length(3).default('USD'),
  taxId: z.string().optional(),
  paymentTerms: z.number().int().default(30),
});

const createBillSchema = z.object({
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
});

const createPaymentRunSchema = z.object({
  description: z.string().optional(),
  paymentDate: z.string(),
  billIds: z.array(z.string().uuid()).min(1),
  currency: z.string().length(3).default('USD'),
});

// ─── Suppliers ────────────────────────────────────────────────────────────────

router.get('/suppliers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'bill', module: 'ap' });
    const { tenantId } = req.tenantContext!;

    const suppliers = await req.withTenantDb!((tx) =>
      tx.supplier.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    );
    sendSuccess(res, suppliers);
  } catch (e) { next(e); }
});

router.post('/suppliers', requireIdempotencyKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'bill', module: 'ap' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = createSupplierSchema.parse(req.body);

    const supplier = await req.withTenantDb!(async (tx) => {
      const count = await tx.supplier.count({ where: { tenantId } });
      const code = `SUP-${String(count + 1).padStart(4, '0')}`;
      const s = await tx.supplier.create({ data: { tenantId, code, ...body } });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'create',
        resourceType: 'supplier', resourceId: s.id,
        after: s as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return s;
    });

    sendCreated(res, supplier);
  } catch (e) { next(e); }
});

router.get('/suppliers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'bill', module: 'ap' });
    const { tenantId } = req.tenantContext!;

    const supplier = await req.withTenantDb!((tx) =>
      tx.supplier.findFirst({
        where: { id: req.params.id, tenantId },
        include: { bills: { orderBy: { billDate: 'desc' }, take: 10 } },
      }),
    );
    if (!supplier) return sendNotFound(res, 'Supplier');
    sendSuccess(res, supplier);
  } catch (e) { next(e); }
});

// ─── Bills ────────────────────────────────────────────────────────────────────

router.get('/bills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'bill', module: 'ap' });
    const { tenantId } = req.tenantContext!;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const cursor = req.query.cursor as string | undefined;
    const status = req.query.status as string | undefined;

    const bills = await req.withTenantDb!((tx) =>
      tx.bill.findMany({
        where: { tenantId, ...(status ? { status } : {}) },
        include: { supplier: { select: { name: true, code: true } }, lines: true },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    );

    const hasMore = bills.length > limit;
    const data = hasMore ? bills.slice(0, limit) : bills;
    sendSuccess(res, { data, nextCursor: hasMore ? data[data.length - 1].id : null, hasMore });
  } catch (e) { next(e); }
});

router.get('/bills/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'bill', module: 'ap' });
    const { tenantId } = req.tenantContext!;

    const bill = await req.withTenantDb!((tx) =>
      tx.bill.findFirst({
        where: { id: req.params.id, tenantId },
        include: { supplier: true, lines: true },
      }),
    );
    if (!bill) return sendNotFound(res, 'Bill');
    sendSuccess(res, bill);
  } catch (e) { next(e); }
});

router.post('/bills', requireIdempotencyKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'bill', module: 'ap' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = createBillSchema.parse(req.body);

    const lineData = body.lines.map((l, i) => {
      const amount = l.quantity * l.unitPrice;
      return { ...l, lineNumber: i + 1, amount };
    });
    const subtotal = lineData.reduce((s, l) => s + l.amount, 0);
    const taxAmount = lineData.reduce((s, l) => s + (l.amount * l.taxRate / 100), 0);
    const totalAmount = subtotal + taxAmount;

    const bill = await req.withTenantDb!(async (tx) => {
      const count = await tx.bill.count({ where: { tenantId } });
      const billNumber = `BILL-${String(count + 1).padStart(5, '0')}`;

      const b = await tx.bill.create({
        data: {
          tenantId, billNumber,
          supplierId: body.supplierId,
          reference: body.reference,
          description: body.description,
          billDate: new Date(body.billDate),
          dueDate: new Date(body.dueDate),
          currency: body.currency, subtotal, taxAmount, totalAmount,
          lines: { create: lineData.map(l => ({ ...l, tenantId })) },
        },
        include: { lines: true, supplier: true },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'create',
        resourceType: 'bill', resourceId: b.id,
        after: b as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return b;
    });

    sendCreated(res, bill);
  } catch (e) { next(e); }
});

router.patch('/bills/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'update', { type: 'bill', module: 'ap' });
    const { tenantId, actorId } = req.tenantContext!;

    const updated = await req.withTenantDb!(async (tx) => {
      const bill = await tx.bill.findFirst({ where: { id: req.params.id, tenantId } });
      if (!bill) return null;
      if (bill.status !== 'Draft') throw new AppError(422, 'Only Draft bills can be submitted');
      const u = await tx.bill.update({ where: { id: bill.id }, data: { status: 'Pending' } });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'submit',
        resourceType: 'bill', resourceId: bill.id,
        before: bill as unknown as Record<string, unknown>,
        after: u as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return u;
    });

    if (!updated) return sendNotFound(res, 'Bill');
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

router.patch('/bills/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'approve', { type: 'bill', module: 'ap' });
    const { tenantId, actorId } = req.tenantContext!;

    const updated = await req.withTenantDb!(async (tx) => {
      const bill = await tx.bill.findFirst({ where: { id: req.params.id, tenantId } });
      if (!bill) return null;
      if (bill.status !== 'Pending') throw new AppError(422, 'Only Pending bills can be approved');
      const u = await tx.bill.update({
        where: { id: bill.id },
        data: { status: 'Approved', approvedBy: actorId, approvedAt: new Date() },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'approve',
        resourceType: 'bill', resourceId: bill.id,
        before: bill as unknown as Record<string, unknown>,
        after: u as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return u;
    });

    if (!updated) return sendNotFound(res, 'Bill');
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

// ─── Payment Runs ─────────────────────────────────────────────────────────────

router.get('/payment-runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'payment_run', module: 'ap' });
    const { tenantId } = req.tenantContext!;

    const runs = await req.withTenantDb!((tx) =>
      tx.paymentRun.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
    );
    sendSuccess(res, runs);
  } catch (e) { next(e); }
});

router.post('/payment-runs', requireIdempotencyKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'payment_run', module: 'ap' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = createPaymentRunSchema.parse(req.body);

    const run = await req.withTenantDb!(async (tx) => {
      const bills = await tx.bill.findMany({
        where: { id: { in: body.billIds }, tenantId, status: 'Approved' },
      });
      if (bills.length === 0) throw new AppError(422, 'No approved bills found for the provided IDs');

      const totalAmount = bills.reduce((s, b) => s + Number(b.totalAmount) - Number(b.amountPaid), 0);
      const count = await tx.paymentRun.count({ where: { tenantId } });
      const runNumber = `PAY-${String(count + 1).padStart(5, '0')}`;

      const r = await tx.paymentRun.create({
        data: {
          tenantId, runNumber,
          paymentDate: new Date(body.paymentDate),
          description: body.description,
          currency: body.currency,
          totalAmount,
          billIds: body.billIds,
        },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'create',
        resourceType: 'payment_run', resourceId: r.id,
        after: r as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return r;
    });

    sendCreated(res, run);
  } catch (e) { next(e); }
});

router.patch('/payment-runs/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'approve', { type: 'payment_run', module: 'ap' });
    const { tenantId, actorId } = req.tenantContext!;

    const updated = await req.withTenantDb!(async (tx) => {
      const run = await tx.paymentRun.findFirst({ where: { id: req.params.id, tenantId } });
      if (!run) return null;
      const u = await tx.paymentRun.update({
        where: { id: run.id },
        data: { status: 'Approved', approvedBy: actorId, approvedAt: new Date() },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'approve',
        resourceType: 'payment_run', resourceId: run.id,
        before: run as unknown as Record<string, unknown>,
        after: u as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return u;
    });

    if (!updated) return sendNotFound(res, 'Payment Run');
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

export default router;
