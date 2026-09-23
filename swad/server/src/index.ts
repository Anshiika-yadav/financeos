import 'dotenv/config';
import { createApp } from './app';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { logger } from './config/logger';

async function main() {
  await connectDatabase();
  await connectRedis();

  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(`FinanceOS server listening on port ${config.port}`, {
      env: config.env,
      port: config.port,
    });
  });

  // ─── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase();
      await disconnectRedis();
      logger.info('Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
