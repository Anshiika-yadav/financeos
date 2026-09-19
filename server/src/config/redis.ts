import IORedis from 'ioredis';
import { config } from './index';
import { logger } from './logger';

// Redis is optional — if REDIS_URL is not set, cache/queue features are
// disabled gracefully so the server still starts on free-tier hosts.
const redisUrl = config.redis.url;

export const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableOfflineQueue: false,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.warn('Redis unavailable — cache/queue disabled', { error: err.message }));

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
  } catch (err) {
    logger.warn('Could not connect to Redis — continuing without cache', {
      error: (err as Error).message,
    });
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
    logger.info('Redis disconnected');
  } catch {
    // ignore
  }
}
