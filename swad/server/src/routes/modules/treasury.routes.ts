import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { assertCanPerform } from '../../services/permissions.service';
import { sendSuccess, sendCreated } from '../../utils/response';

const router = Router();
router.use(authenticate, resolveTenantContext);

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

router.post('/bank-accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'bank_account', module: 'treasury' });
    const { tenantId } = req.tenantContext!;
    const body = z.object({
      accountName: z.string().min(1),
      bankName: z.string().min(1),
      accountNumber: z.string().min(1),
      bsb: z.string().optional(),
      currency: z.string().length(3).default('USD'),
      currentBalance: z.number().default(0),
    }).parse(req.body);
    const account = await req.withTenantDb!((tx) =>
      tx.bankAccount.create({ data: { tenantId, ...body } }),
    );
    sendCreated(res, account);
  } catch (e) { next(e); }
});

router.get('/cash-position', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'cash_position', module: 'treasury' });
    const { tenantId } = req.tenantContext!;

    const result = await req.withTenantDb!(async (tx) => {
      const accounts = await tx.bankAccount.findMany({ where: { tenantId, isActive: true } });
      const pendingPayments = await tx.paymentRun.aggregate({
        where: { tenantId, status: { in: ['Draft', 'Approved'] } },
        _sum: { totalAmount: true },
      });
      const outstandingAR = await tx.invoice.aggregate({
        where: { tenantId, status: { in: ['Posted', 'Approved', 'Partially Paid'] } },
        _sum: { totalAmount: true, amountPaid: true },
      });
      return { accounts, pendingPayments, outstandingAR };
    });

    const totalCash = result.accounts.reduce((s, a) => s + Number(a.currentBalance), 0);

    sendSuccess(res, {
      accounts: result.accounts,
      totalCash,
      pendingPayments: Number(result.pendingPayments._sum.totalAmount ?? 0),
      outstandingAR:
        Number(result.outstandingAR._sum.totalAmount ?? 0) -
        Number(result.outstandingAR._sum.amountPaid ?? 0),
    });
  } catch (e) { next(e); }
});

router.get('/bank-accounts/:id/statements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'bank_statement', module: 'treasury' });
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

router.post('/bank-accounts/:id/statements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'bank_statement', module: 'treasury' });
    const { tenantId } = req.tenantContext!;
    const body = z.object({
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
    }).parse(req.body);

    const statement = await req.withTenantDb!((tx) =>
      tx.bankStatement.create({
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
      }),
    );

    sendCreated(res, statement);
  } catch (e) { next(e); }
});

export default router;
