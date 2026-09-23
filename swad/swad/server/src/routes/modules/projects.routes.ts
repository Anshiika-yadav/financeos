import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { assertCanPerform } from '../../services/permissions.service';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';

const router = Router();
router.use(authenticate, resolveTenantContext);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'project', module: 'projects' });
    const { tenantId } = req.tenantContext!;
    const projects = await req.withTenantDb!((tx) =>
      tx.project.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
    );
    sendSuccess(res, projects);
  } catch (e) { next(e); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'project', module: 'projects' });
    const { tenantId } = req.tenantContext!;
    const project = await req.withTenantDb!((tx) =>
      tx.project.findFirst({ where: { id: req.params.id, tenantId }, include: { costs: true } }),
    );
    if (!project) return sendNotFound(res, 'Project');
    sendSuccess(res, project);
  } catch (e) { next(e); }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'project', module: 'projects' });
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

    const project = await req.withTenantDb!(async (tx) => {
      const count = await tx.project.count({ where: { tenantId } });
      const projectCode = `PRJ-${String(count + 1).padStart(4, '0')}`;
      return tx.project.create({
        data: {
          tenantId, projectCode, managedBy: actorId,
          ...body, startDate: new Date(body.startDate),
          endDate: body.endDate ? new Date(body.endDate) : null,
        },
      });
    });

    sendCreated(res, project);
  } catch (e) { next(e); }
});

router.post('/:id/costs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'project_cost', module: 'projects' });
    const { tenantId } = req.tenantContext!;
    const body = z.object({
      category: z.string(),
      description: z.string(),
      amount: z.number().positive(),
      costDate: z.string(),
    }).parse(req.body);

    const cost = await req.withTenantDb!(async (tx) => {
      // Verify the project belongs to this tenant before mutating it —
      // the original code updated actualCost by id alone with no tenant check.
      const project = await tx.project.findFirst({ where: { id: req.params.id, tenantId } });
      if (!project) return null;

      const created = await tx.projectCost.create({
        data: { tenantId, projectId: project.id, ...body, costDate: new Date(body.costDate) },
      });

      await tx.project.update({
        where: { id: project.id },
        data: { actualCost: { increment: body.amount } },
      });

      return created;
    });

    if (!cost) return sendNotFound(res, 'Project');
    sendCreated(res, cost);
  } catch (e) { next(e); }
});

// Contracts
router.get('/contracts/list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'contract', module: 'projects' });
    const { tenantId } = req.tenantContext!;
    const contracts = await req.withTenantDb!((tx) =>
      tx.contract.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
    );
    sendSuccess(res, contracts);
  } catch (e) { next(e); }
});

router.post('/contracts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'contract', module: 'projects' });
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

    const contract = await req.withTenantDb!(async (tx) => {
      const count = await tx.contract.count({ where: { tenantId } });
      const contractNumber = `CTR-${String(count + 1).padStart(4, '0')}`;
      return tx.contract.create({
        data: {
          tenantId, contractNumber, ...body,
          startDate: new Date(body.startDate),
          endDate: body.endDate ? new Date(body.endDate) : null,
        },
      });
    });

    sendCreated(res, contract);
  } catch (e) { next(e); }
});

export default router;
