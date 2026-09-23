import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { assertCanPerform } from '../../services/permissions.service';
import { sendSuccess, sendCreated } from '../../utils/response';

const router = Router();

const createProfileSchema = z.object({
  name: z.string().min(1),
  country: z.string().length(2),
});

const createRateSchema = z.object({
  name: z.string().min(1),
  rate: z.number().min(0).max(100),
  taxType: z.string().default('VAT'),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
});

router.use(authenticate, resolveTenantContext);

/**
 * GET /api/v1/tax/profiles
 */
router.get('/profiles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'tax_profile', module: 'tax' });
    const ctx = req.tenantContext!;

    const profiles = await req.withTenantDb!((tx) =>
      tx.taxProfile.findMany({
        where: { tenantId: ctx.tenantId },
        include: { taxRates: true },
        orderBy: { createdAt: 'desc' },
      }),
    );

    sendSuccess(res, profiles);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/tax/profiles
 */
router.post('/profiles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'tax_profile', module: 'tax' });
    const ctx = req.tenantContext!;
    const body = createProfileSchema.parse(req.body);

    const profile = await req.withTenantDb!((tx) =>
      tx.taxProfile.create({
        data: { ...body, tenantId: ctx.tenantId },
      }),
    );

    sendCreated(res, profile);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/tax/profiles/:profileId/rates
 */
router.get('/profiles/:profileId/rates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'tax_rate', module: 'tax' });
    const ctx = req.tenantContext!;

    const rates = await req.withTenantDb!((tx) =>
      tx.taxRate.findMany({
        where: { tenantId: ctx.tenantId, taxProfileId: req.params.profileId },
        orderBy: { effectiveFrom: 'desc' },
      }),
    );

    sendSuccess(res, rates);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/tax/profiles/:profileId/rates
 */
router.post('/profiles/:profileId/rates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'create', { type: 'tax_rate', module: 'tax' });
    const ctx = req.tenantContext!;
    const body = createRateSchema.parse(req.body);

    const rate = await req.withTenantDb!((tx) =>
      tx.taxRate.create({
        data: {
          ...body,
          tenantId: ctx.tenantId,
          taxProfileId: req.params.profileId,
          effectiveFrom: new Date(body.effectiveFrom),
          effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
        },
      }),
    );

    sendCreated(res, rate);
  } catch (err) {
    next(err);
  }
});

export default router;