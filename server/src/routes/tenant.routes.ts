import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenantContext } from '../middleware/auth';
import { requireIdempotencyKey } from '../middleware/idempotency';
import { prisma } from '../config/database';
import { writeAuditLogTx } from '../services/audit.service';
import { assertCanPerform } from '../services/permissions.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { NotFoundError } from '../middleware/errorHandler';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createTenantSchema = z.object({
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
  legalName: z.string().min(1).max(200),
  displayName: z.string().min(1).max(100),
  country: z.string().length(2),
  timezone: z.string().min(1),
  baseCurrency: z.string().length(3),
});

const inviteUserSchema = z.object({
  email: z.string().email(),
  roleId: z.string().uuid(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/tenants
 * Create a new tenant (called during onboarding wizard step 1).
 * Any authenticated user can create a tenant; they become the owner.
 *
 * NOTE: this route intentionally does NOT use resolveTenantContext/withTenantDb
 * — there is no tenant yet. Instead, the transaction below sets app.tenant_id
 * to the brand-new tenant's own id right after creating it, so every
 * subsequent insert in the same transaction (membership, role assignment,
 * audit log) passes RLS correctly.
 */
router.post(
  '/',
  authenticate,
  requireIdempotencyKey,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createTenantSchema.parse(req.body);
      const userId = req.user!.userId;

      // Find or create the built-in "owner" role (tenantId: null → visible to all)
      let ownerRole = await prisma.role.findFirst({
        where: { tenantId: null, name: 'owner', isBuiltIn: true },
      });

      if (!ownerRole) {
        ownerRole = await prisma.role.create({
          data: { name: 'owner', isBuiltIn: true, description: 'Tenant owner' },
        });
      }

      const [tenant, membership] = await prisma.$transaction(async (tx) => {
        const t = await tx.tenant.create({ data: body });

        // From here on, this connection is scoped to the new tenant.
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${t.id}, TRUE)`;
        await tx.$executeRaw`SELECT set_config('app.actor_id', ${userId}, TRUE)`;

        const m = await tx.tenantUser.create({
          data: {
            tenantId: t.id,
            userId,
            joinedAt: new Date(),
          },
        });

        await tx.tenantUserRole.create({
          data: { tenantUserId: m.id, roleId: ownerRole!.id },
        });

        await writeAuditLogTx(tx, {
          tenantId: t.id,
          actorId: userId,
          action: 'create',
          resourceType: 'tenant',
          resourceId: t.id,
          after: t as Record<string, unknown>,
          correlationId: req.correlationId,
        });

        return [t, m];
      });

      sendCreated(res, { tenant, membership });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/tenants/:tenantId
 */
router.get(
  '/:tenantId',
  authenticate,
  resolveTenantContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertCanPerform(req.tenantContext!, 'read', { type: 'tenant', module: 'tenant' });

      const tenant = await req.withTenantDb!((tx) =>
        tx.tenant.findUnique({ where: { id: req.params.tenantId } }),
      );

      if (!tenant || tenant.id !== req.tenantContext!.tenantId) {
        throw new NotFoundError('Tenant');
      }

      sendSuccess(res, tenant);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/tenants/:tenantId/users
 * Invite a user to the tenant.
 */
router.post(
  '/:tenantId/users',
  authenticate,
  resolveTenantContext,
  requireIdempotencyKey,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertCanPerform(req.tenantContext!, 'manage_users', { type: 'tenant', module: 'tenant' });

      const { email, roleId } = inviteUserSchema.parse(req.body);
      const ctx = req.tenantContext!;

      const result = await req.withTenantDb!(async (tx) => {
        const invitedUser = await tx.user.findUnique({ where: { email } });
        if (!invitedUser) {
          throw new NotFoundError('User');
        }

        const existing = await tx.tenantUser.findUnique({
          where: {
            tenantId_userId: { tenantId: ctx.tenantId, userId: invitedUser.id },
          },
        });

        if (existing) {
          return { alreadyMember: true as const, membership: existing };
        }

        // roleId must belong to this tenant or be a built-in platform role
        const role = await tx.role.findFirst({
          where: { id: roleId, OR: [{ tenantId: ctx.tenantId }, { tenantId: null }] },
        });
        if (!role) {
          throw new NotFoundError('Role');
        }

        const m = await tx.tenantUser.create({
          data: { tenantId: ctx.tenantId, userId: invitedUser.id, joinedAt: new Date() },
        });
        await tx.tenantUserRole.create({
          data: { tenantUserId: m.id, roleId },
        });

        await writeAuditLogTx(tx, {
          tenantId: ctx.tenantId,
          actorId: ctx.actorId,
          action: 'invite_user',
          resourceType: 'tenant',
          resourceId: ctx.tenantId,
          after: { invitedUserId: invitedUser.id, roleId },
          correlationId: req.correlationId,
        });

        return { alreadyMember: false as const, membership: m };
      });

      if (result.alreadyMember) {
        sendSuccess(res, { message: 'User already a member', membership: result.membership });
        return;
      }

      sendCreated(res, result.membership);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/tenants/:tenantId/audit-logs
 * Cursor-paginated audit log for the tenant.
 */
router.get(
  '/:tenantId/audit-logs',
  authenticate,
  resolveTenantContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertCanPerform(req.tenantContext!, 'read', { type: 'tenant', module: 'tenant' });

      const ctx = req.tenantContext!;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const cursor = req.query.cursor as string | undefined;

      const logs = await req.withTenantDb!((tx) =>
        tx.auditLog.findMany({
          where: { tenantId: ctx.tenantId },
          orderBy: { createdAt: 'desc' },
          take: limit + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        }),
      );

      const hasMore = logs.length > limit;
      const data = hasMore ? logs.slice(0, limit) : logs;
      const nextCursor = hasMore ? data[data.length - 1].id : null;

      sendSuccess(res, { data, nextCursor, hasMore });
    } catch (err) {
      next(err);
    }
  },
);

export default router;