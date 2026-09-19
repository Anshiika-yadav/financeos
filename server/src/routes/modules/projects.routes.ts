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
    const projects = await prisma.project.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    sendSuccess(res, projects);
  } catch (e) { next(e); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const project = await prisma.project.findFirst({ where: { id: req.params.id, tenantId }, include: { costs: true } });
    if (!project) return sendNotFound(res, 'Project');
    sendSuccess(res, project);
  } catch (e) { next(e); }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, actorId } = req.tenantContext!;
    const body = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      customerId: z.string().uuid().optional(),
      startDate: z.string(),
      endDate: z.string().optional(),
      budget: z.number().min(0).default(0),
      currency: z.string().length(3).default('USD'),
    }).parse(req.body);

    const count = await prisma.project.count({ where: { tenantId } });
    const projectCode = `PRJ-${String(count + 1).padStart(4, '0')}`;

    const project = await prisma.project.create({
      data: {
        tenantId, projectCode, managedBy: actorId,
        ...body, startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
    });
    sendCreated(res, project);
  } catch (e) { next(e); }
});

router.post('/:id/costs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const body = z.object({
      category: z.string(),
      description: z.string(),
      amount: z.number().positive(),
      costDate: z.string(),
    }).parse(req.body);

    const cost = await prisma.projectCost.create({
      data: { tenantId, projectId: req.params.id, ...body, costDate: new Date(body.costDate) },
    });

    await prisma.project.update({ where: { id: req.params.id }, data: { actualCost: { increment: body.amount } } });
    sendCreated(res, cost);
  } catch (e) { next(e); }
});

// Contracts
router.get('/contracts/list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const contracts = await prisma.contract.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    sendSuccess(res, contracts);
  } catch (e) { next(e); }
});

router.post('/contracts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.tenantContext!;
    const body = z.object({
      title: z.string().min(1),
      counterparty: z.string().min(1),
      contractType: z.enum(['Customer', 'Supplier', 'Lease', 'Employment']),
      startDate: z.string(),
      endDate: z.string().optional(),
      value: z.number().min(0).default(0),
      currency: z.string().length(3).default('USD'),
      notes: z.string().optional(),
    }).parse(req.body);

    const count = await prisma.contract.count({ where: { tenantId } });
    const contractNumber = `CTR-${String(count + 1).padStart(4, '0')}`;
    const contract = await prisma.contract.create({
      data: { tenantId, contractNumber, ...body, startDate: new Date(body.startDate), endDate: body.endDate ? new Date(body.endDate) : null },
    });
    sendCreated(res, contract);
  } catch (e) { next(e); }
});

export default router;
