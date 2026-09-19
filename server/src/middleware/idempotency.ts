import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { sendBadRequest } from '../utils/response';

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24; // 24 hours

/**
 * Enforces Idempotency-Key on POST/import/payment endpoints.
 * If Redis is unavailable the check is skipped gracefully — the header is
 * still required (for audit / tracing purposes) but replay protection is
 * best-effort only when Redis is down.
 */
export function requireIdempotencyKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const key = req.headers['idempotency-key'] as string;
  if (!key) {
    sendBadRequest(res, 'Idempotency-Key header is required for this operation');
    return;
  }

  const scopeId = req.tenantContext?.tenantId ?? req.user?.userId ?? 'anon';
  const cacheKey = `idempotency:${scopeId}:${key}`;

  (async () => {
    try {
      // If Redis is not connected, skip replay check but still allow the request
      if (redis.status !== 'ready') {
        next();
        return;
      }

      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { status: number; body: unknown };
        res.status(parsed.status).json(parsed.body);
        return;
      }

      // Intercept the response to cache it
      const originalJson = res.json.bind(res);
      res.json = (body: unknown) => {
        if (res.statusCode < 500) {
          redis
            .setex(cacheKey, IDEMPOTENCY_TTL_SECONDS, JSON.stringify({ status: res.statusCode, body }))
            .catch(() => {/* best-effort */});
        }
        return originalJson(body);
      };

      next();
    } catch {
      // Redis error — degrade gracefully, don't block the request
      next();
    }
  })();
}
