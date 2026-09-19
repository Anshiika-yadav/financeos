import { TenantContext, Action, ResourceType, PermissionResource, PlatformRole } from '../types';
import { ForbiddenError } from '../middleware/errorHandler';

/**
 * canPerform — the single authorization check used everywhere.
 *
 * Resolution order (Phase 0 rule 4):
 *   platform role → tenant membership → role set → module permission →
 *   action permission → entity/dimension scope → transaction rule
 *
 * For now, entity/dimension scope and transaction rules are stubs
 * that always pass — they'll be fleshed out per-module.
 */
export function canPerform(
  ctx: TenantContext,
  action: Action,
  resource: PermissionResource,
  options: { strict?: boolean } = {},
): boolean {
  const { strict = false } = options;

  // 1. Platform super_admin bypasses all tenant-level checks
  //    (platform role is carried on req.user, not in TenantContext)
  //    Callers that have access to req.user can pass it via resource metadata.
  if (resource.actorPlatformRole === PlatformRole.SuperAdmin) {
    return true;
  }

  // 2. Build the scope string this action requires
 
    const requiredScope = buildScope(resource.module, resource.type, action);

  // 3. Check the actor's permitted scope list (flattened from role assignments)
  const hasPermission =
    ctx.permittedScope.includes(requiredScope) ||
    ctx.permittedScope.includes(buildScope(resource.module, resource.type, '*')) ||
    ctx.permittedScope.includes(buildScope(resource.module, '*', action)) ||
    ctx.permittedScope.includes(buildScope('*', resource.type, action)) ||
    ctx.permittedScope.includes(buildScope('*', '*', '*'));
  if (!hasPermission) {
    if (strict) {
      throw new ForbiddenError(
        `Not permitted to ${action} ${resource.type}`,
      );
    }
    return false;
  }

  // 4. Ownership check — if the resource has an ownerId, it must match the actor
  //    UNLESS the actor has an admin-level scope
  if (resource.ownerId && resource.ownerId !== ctx.actorId) {
    const hasAdminScope = ctx.permittedScope.some((s) =>
      s.endsWith(':*') || s.startsWith('*:'),
    );
    if (!hasAdminScope) {
      if (strict) throw new ForbiddenError('Access denied: resource owned by another user');
      return false;
    }
  }

  // 5. Tenant boundary — resource must belong to the same tenant
  if (resource.tenantId && resource.tenantId !== ctx.tenantId) {
    if (strict) throw new ForbiddenError('Cross-tenant access denied');
    return false;
  }

  return true;
}

/**
 * Convenience wrapper that throws ForbiddenError if permission is denied.
 */
export function assertCanPerform(
  ctx: TenantContext,
  action: Action,
  resource: PermissionResource,
): void {
  canPerform(ctx, action, resource, { strict: true });
}

function buildScope(
  module: string | '*',
  resourceType: ResourceType | '*',
  action: Action | '*',
): string {
  return `${module}:${resourceType}:${action}`;
}
