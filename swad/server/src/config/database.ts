import { PrismaClient, Prisma } from '@prisma/client';
import { config } from './index';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      config.env === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

if (config.env !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

/**
 * withActor — runs fn inside one DB transaction with app.actor_id set.
 * Used ONLY for the login-time "which tenants do I belong to" bootstrap
 * lookup, before a tenant has been chosen (see self_membership_lookup policy).
 */
export async function withActor<T>(
  actorId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.actor_id', ${actorId}, TRUE)`;
    return fn(tx);
  });
}

/**
 * withTenant — runs fn inside one DB transaction with BOTH app.tenant_id and
 * app.actor_id set for the duration of the transaction. This is the ONLY
 * correct way to run tenant-scoped queries: it guarantees the SET LOCAL and
 * every subsequent query share the same physical connection, which a bare
 * `prisma.$executeRawUnsafe(...)` followed by separate `prisma.x.findMany()`
 * calls does NOT guarantee (Prisma's connection pool may hand those queries
 * a different connection, silently resetting the session variable to empty
 * and making RLS block everything).
 */
export async function withTenant<T>(
  tenantId: string,
  actorId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, TRUE)`;
    await tx.$executeRaw`SELECT set_config('app.actor_id', ${actorId}, TRUE)`;
    return fn(tx);
  });
}