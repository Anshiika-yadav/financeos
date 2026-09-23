import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { assertCanPerform } from '../../services/permissions.service';
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response';

const router = Router();
router.use(authenticate, resolveTenantContext);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'asset', module: 'assets' });
    const { tenantId } = req.tenantContext!;
    const assets = await req.withTenantDb!((tx) =>
      tx.asset.findMany({ where: { tenantId }, orderBy: { acquisitionDate: 'desc' } }),
    );
    sendSuccess(res, assets);
  } catch (e) { next(e); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'asset', module: 'assets' });
    const { tenantId } = req.tenantContext!;
    const asset = await req.withTenantDb!((tx) =>
      tx.asset.findFirst({ where: { id: req.params.id, tenantId } }),
    );
    if (!asset) return sendNotFound(res, 'Asset');
    sendSuccess(res, asset);
  } catch (e) { next(e); }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'asset', module: 'assets' });
    const { tenantId } = req.tenantContext!;
    const body = z.object({
      name: z.string().min(1),
      category: z.string().min(1),
      description: z.string().optional(),
      acquisitionDate: z.string(),
      acquisitionCost: z.number().positive(),
      residualValue: z.number().min(0).default(0),
      usefulLifeYears: z.number().int().positive(),
      depreciationMethod: z.string().default('Straight Line'),
      location: z.string().optional(),
    }).parse(req.body);

    const asset = await req.withTenantDb!(async (tx) => {
      const count = await tx.asset.count({ where: { tenantId } });
      const assetNumber = `AST-${String(count + 1).padStart(5, '0')}`;
      return tx.asset.create({
        data: {
          tenantId, assetNumber, netBookValue: body.acquisitionCost,
          ...body, acquisitionDate: new Date(body.acquisitionDate),
        },
      });
    });

    sendCreated(res, asset);
  } catch (e) { next(e); }
});

router.get('/depreciation/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'depreciation_run', module: 'assets' });
    const { tenantId } = req.tenantContext!;
    const runs = await req.withTenantDb!((tx) =>
      tx.depreciationRun.findMany({ where: { tenantId }, orderBy: { runDate: 'desc' } }),
    );
    sendSuccess(res, runs);
  } catch (e) { next(e); }
});

export default router;
