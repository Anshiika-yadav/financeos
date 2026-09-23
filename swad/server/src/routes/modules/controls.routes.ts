import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, resolveTenantContext } from '../../middleware/auth';
import { assertCanPerform } from '../../services/permissions.service';
import { sendSuccess } from '../../utils/response';

const router = Router();
router.use(authenticate, resolveTenantContext);

/**
 * GET /api/v1/controls/audit-trail
 *
 * Query params:
 *   resourceType  (optional) — filter by a specific resource type
 *   resourceId    (optional) — filter by a specific record id
 *   actorId       (optional) — filter by actor
 *   limit         (optional, max 200, default 50)
 *   cursor        (optional) — cursor-based pagination
 */
router.get('/audit-trail', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertCanPerform(req.tenantContext!, 'read', { type: 'tenant', module: 'controls' });
    const { tenantId } = req.tenantContext!;

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const cursor = req.query.cursor as string | undefined;
    const resourceType = req.query.resourceType as string | undefined;
    const resourceId = req.query.resourceId as string | undefined;
    const actorId = req.query.actorId as string | undefined;

    const logs = await req.withTenantDb!((tx) =>
      tx.auditLog.findMany({
        where: {
          tenantId,
          ...(resourceType ? { resourceType } : {}),
          ...(resourceId ? { resourceId } : {}),
          ...(actorId ? { actorId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    );

    const hasMore = logs.length > limit;
    const data = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    sendSuccess(res, { data, nextCursor, hasMore });
  } catch (e) { next(e); }
});

export default router;
