import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';

const router = Router();
router.use(authenticate, resolveTenantContext);

router.get('/bank-accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const accounts = await prisma.bankAccount.findMany({ where: { tenantId, isActive: true }, orderBy: { accountName: 'asc' } });
    sendSuccess(res, accounts);
  } catch (e) { next(e); }
});

router.post('/bank-accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const body = z.object({
      accountName: z.string().min(1),
      bankName: z.string().min(1),
      accountNumber: z.string().min(1),
      bsb: z.string().optional(),
      currency: z.string().length(3).default('USD'),
      currentBalance: z.number().default(0),
    }).parse(req.body);
    const account = await prisma.bankAccount.create({ data: { tenantId, ...body } });
    sendCreated(res, account);
  } catch (e) { next(e); }
});

router.get('/cash-position', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const accounts = await prisma.bankAccount.findMany({ where: { tenantId, isActive: true } });
    const totalCash = accounts.reduce((s, a) => s + Number(a.currentBalance), 0);

    const pendingPayments = await prisma.paymentRun.aggregate({
      where: { tenantId, status: { in: ['Draft', 'Approved'] } },
      _sum: { totalAmount: true },
    });

    const outstandingAR = await prisma.invoice.aggregate({
      where: { tenantId, status: { in: ['Posted', 'Approved', 'Partially Paid'] } },
      _sum: { totalAmount: true, amountPaid: true },
    });

    sendSuccess(res, {
      accounts,
      totalCash,
      pendingPayments: Number(pendingPayments._sum.totalAmount ?? 0),
      outstandingAR: Number(outstandingAR._sum.totalAmount ?? 0) - Number(outstandingAR._sum.amountPaid ?? 0),
    });
  } catch (e) { next(e); }
});

router.get('/bank-accounts/:id/statements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const statements = await prisma.bankStatement.findMany({
      where: { tenantId, bankAccountId: req.params.id },
      include: { lines: true },
      orderBy: { statementDate: 'desc' },
    });
    sendSuccess(res, statements);
  } catch (e) { next(e); }
});

router.post('/bank-accounts/:id/statements', async (req: Request, res: Response, next: NextFunction) => {
  try {
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

    const statement = await prisma.bankStatement.create({
      data: {
        tenantId,
        bankAccountId: req.params.id,
        statementDate: new Date(body.statementDate),
        openingBalance: body.openingBalance,
        closingBalance: body.closingBalance,
        lines: {
          create: body.lines.map(l => ({
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

    sendCreated(res, statement);
  } catch (e) { next(e); }
});

export default router;
