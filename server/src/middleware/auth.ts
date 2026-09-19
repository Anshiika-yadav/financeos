import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { withActor, withTenant } from '../config/database';
import { TenantContext, PlatformRole } from '../types';
import { sendUnauthorized, sendForbidden } from '../utils/response';

interface JwtPayload {
  sub: string;       // userId
  email: string;
  platformRole?: PlatformRole;
  iat: number;
  exp: number;
}

/**
 * Verifies JWT, attaches req.user.
 * Does NOT attach tenantContext — that is done by resolveTenantContext().
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    sendUnauthorized(res, 'Missing or malformed Authorization header');
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = {
      userId: payload.sub,
      email: payload.email,
      platformRole: payload.platformRole,
    };
    next();
  } catch {
    sendUnauthorized(res, 'Invalid or expired token');
  }
}

/**
 * Must run after authenticate().
 * Derives TenantContext from the JWT user + tenant slug in the subdomain or
 * X-Tenant-Slug header. Attaches req.tenantContext and req.withTenantDb.
 */
export async function resolveTenantContext(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    sendUnauthorized(res, 'Not authenticated');
    return;
  }

  // Tenant slug comes from X-Tenant-Slug header or subdomain
  const tenantSlug =
    (req.headers['x-tenant-slug'] as string) ||
    extractSubdomain(req.hostname);

  if (!tenantSlug) {
    sendForbidden(res, 'Tenant context could not be resolved');
    return;
  }

  try {
    // Look up the tenant membership. Uses withActor (not withTenant) because
    // we don't know the tenant yet — this is the bootstrap step the
    // self_membership_lookup RLS policy on tenant_users exists for.
    const membership = await withActor(req.user.userId, (tx) =>
      tx.tenantUser.findFirst({
        where: {
          userId: req.user!.userId,
          isActive: true,
          tenant: { slug: tenantSlug, isActive: true },
        },
        include: {
          tenant: { select: { id: true } },
          roleAssignments: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: { permission: true },
                  },
                },
              },
            },
          },
        },
      }),
    );

    if (!membership) {
      sendForbidden(res, 'Access denied to this tenant');
      return;
    }

    // Flatten all permitted actions into scope strings: "module:resource:action"
    const permittedScope = membership.roleAssignments.flatMap((ra) =>
      ra.role.permissions.map(
        (rp) =>
          `${rp.permission.module}:${rp.permission.resourceType}:${rp.permission.action}`,
      ),
    );

    const tenantContext: TenantContext = {
      tenantId: membership.tenant.id,
      actorId: req.user.userId,
      permittedScope,
    };

    req.tenantContext = tenantContext;

    // Every subsequent tenant-scoped DB call in this request MUST go through
    // this — it guarantees the RLS session variables and the query run on
    // the same connection (see withTenant in config/database.ts).
    req.withTenantDb = (fn) =>
      withTenant(tenantContext.tenantId, tenantContext.actorId, fn);

    next();
  } catch (err) {
    next(err);
  }
}

function extractSubdomain(hostname: string): string | null {
  // e.g. "acme.financeos.com" → "acme"
  const parts = hostname.split('.');
  if (parts.length >= 3) return parts[0];
  return null;
}