import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';

const router = Router();
router.use(authenticate, resolveTenantContext);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const budgets = await prisma.budget.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    sendSuccess(res, budgets);
  } catch (e) { next(e); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const budget = await prisma.budget.findFirst({ where: { id: req.params.id, tenantId }, include: { lines: true } });
    if (!budget) return sendNotFound(res, 'Budget');
    sendSuccess(res, budget);
  } catch (e) { next(e); }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const body = z.object({
      name: z.string().min(1),
      fiscalYear: z.string().min(1),
      currency: z.string().length(3).default('USD'),
      lines: z.array(z.object({
        accountCode: z.string().optional(),
        accountName: z.string(),
        period: z.string(),
        amount: z.number(),
        notes: z.string().optional(),
      })).default([]),
    }).parse(req.body);

    const totalAmount = body.lines.reduce((s, l) => s + l.amount, 0);
    const budget = await prisma.budget.create({
      data: {
        tenantId, name: body.name, fiscalYear: body.fiscalYear,
        currency: body.currency, totalAmount,
        lines: { create: body.lines.map(l => ({ ...l, tenantId })) },
      },
      include: { lines: true },
    });
    sendCreated(res, budget);
  } catch (e) { next(e); }
});

// Variance report: budget vs actuals
router.get('/:id/variance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const budget = await prisma.budget.findFirst({ where: { id: req.params.id, tenantId }, include: { lines: true } });
    if (!budget) return sendNotFound(res, 'Budget');

    const postedLines = await prisma.glJournalLine.findMany({
      where: { tenantId, journal: { status: 'Posted' } },
      include: { account: true },
    });

    const variance = budget.lines.map(bl => {
      const actuals = postedLines
        .filter(l => l.account.code === bl.accountCode)
        .reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
      return { ...bl, actuals, variance: Number(bl.amount) - actuals };
    });

    sendSuccess(res, { budget, variance });
  } catch (e) { next(e); }
});

export default router;
