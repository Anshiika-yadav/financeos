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

const createBankAccountSchema = z.object({
  accountName: z.string().min(1),
  bankName: z.string().min(1),
  accountNumber: z.string().min(1),
  bsb: z.string().optional(),
  currency: z.string().length(3).default('USD'),
  currentBalance: z.number().default(0),
});

const importStatementSchema = z.object({
  statementDate: z.string(),
  openingBalance: z.number(),
  closingBalance: z.number(),
  lines: z.array(z.object({
    transactionDate: z.string(),
    description: z.string(),
    amount: z.number(),
    balance: z.number(),
    reference: z.string().optional(),
  })),
});

// ─── Bank accounts ────────────────────────────────────────────────────────────

router.get('/bank-accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'bank_account', module: 'treasury' });
    const { tenantId } = req.tenantContext!;
    const accounts = await req.withTenantDb!((tx) =>
      tx.bankAccount.findMany({ where: { tenantId, isActive: true }, orderBy: { accountName: 'asc' } }),
    );
    sendSuccess(res, accounts);
  } catch (e) { next(e); }
});

router.post('/bank-accounts', requireIdempotencyKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'bank_account', module: 'treasury' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = createBankAccountSchema.parse(req.body);

    const account = await req.withTenantDb!(async (tx) => {
      const a = await tx.bankAccount.create({ data: { tenantId, ...body } });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'create',
        resourceType: 'bank_account', resourceId: a.id,
        after: a as unknown as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return a;
    });
    sendCreated(res, account);
  } catch (e) { next(e); }
});

// ─── Cash position (aggregate across accounts) ────────────────────────────────

router.get('/cash-position', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'bank_account', module: 'treasury' });
    const { tenantId } = req.tenantContext!;

    const result = await req.withTenantDb!(async (tx) => {
      const accounts = await tx.bankAccount.findMany({ where: { tenantId, isActive: true } });
      const totalCash = accounts.reduce((s, a) => s + Number(a.currentBalance), 0);

      const pendingPayments = await tx.paymentRun.aggregate({
        where: { tenantId, status: { in: ['Draft', 'Approved'] } },
        _sum: { totalAmount: true },
      });

      const outstandingAR = await tx.invoice.aggregate({
        where: { tenantId, status: { in: ['Posted', 'Approved', 'Partially Paid'] } },
        _sum: { totalAmount: true, amountPaid: true },
      });

      return {
        accounts,
        totalCash,
        pendingPayments: Number(pendingPayments._sum.totalAmount ?? 0),
        outstandingAR:
          Number(outstandingAR._sum.totalAmount ?? 0) -
          Number(outstandingAR._sum.amountPaid ?? 0),
      };
    });

    sendSuccess(res, result);
  } catch (e) { next(e); }
});

// ─── Bank statements ──────────────────────────────────────────────────────────

router.get('/bank-accounts/:id/statements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'bank_account', module: 'treasury' });
    const { tenantId } = req.tenantContext!;

    const statements = await req.withTenantDb!((tx) =>
      tx.bankStatement.findMany({
        where: { tenantId, bankAccountId: req.params.id },
        include: { lines: true },
        orderBy: { statementDate: 'desc' },
      }),
    );
    sendSuccess(res, statements);
  } catch (e) { next(e); }
});

router.post('/bank-accounts/:id/statements', requireIdempotencyKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'bank_account', module: 'treasury' });
    const { tenantId, actorId } = req.tenantContext!;
    const body = importStatementSchema.parse(req.body);

    const statement = await req.withTenantDb!(async (tx) => {
      const stmt = await tx.bankStatement.create({
        data: {
          tenantId,
          bankAccountId: req.params.id,
          statementDate: new Date(body.statementDate),
          openingBalance: body.openingBalance,
          closingBalance: body.closingBalance,
          lines: {
            create: body.lines.map((l) => ({
              tenantId,
              transactionDate: new Date(l.transactionDate),
              description: l.description,
              amount: l.amount,
              balance: l.balance,
              reference: l.reference,
            })),
          },
        },
        include: { lines: true },
      });
      await writeAuditLogTx(tx, {
        tenantId, actorId, action: 'import',
        resourceType: 'bank_account', resourceId: req.params.id,
        after: { statementId: stmt.id } as Record<string, unknown>,
        correlationId: req.correlationId,
      });
      return stmt;
    });
    sendCreated(res, statement);
  } catch (e) { next(e); }
});

export default router;
