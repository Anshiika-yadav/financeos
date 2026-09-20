import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AuditEvent } from '../types';
import { logger } from '../config/logger';
/**
 * writeAuditLog — the single entry point for all audit events.
 *
 * Fire-and-forget pattern: failures are logged but never throw so they
 * don't interfere with the main transaction.  For critical paths (posting,
 * approvals) callers should include audit writes in the same DB transaction.
 */
export async function writeAuditLog(event: AuditEvent): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: event.tenantId,
        actorId: event.actorId,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
               beforeState: (event.before ?? undefined) as Prisma.InputJsonValue | undefined,
        afterState: (event.after ?? undefined) as Prisma.InputJsonValue | undefined,
        metadata: (event.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        correlationId: event.correlationId,
      },
    });
  } catch (err) {
    logger.error('Failed to write audit log', {
      error: (err as Error).message,
      event,
    });
  }
}

/**
 * writeAuditLogTx — version for use inside a Prisma transaction.
 * Returns the create operation so it can be included in a $transaction([...]).
 */
export function writeAuditLogTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  event: AuditEvent,
) {
  return tx.auditLog.create({
    data: {
      tenantId: event.tenantId,
      actorId: event.actorId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      beforeState: (event.before ?? undefined) as Prisma.InputJsonValue | undefined,
      afterState: (event.after ?? undefined) as Prisma.InputJsonValue | undefined,
      metadata: (event.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      correlationId: event.correlationId,
    },
  });
}
