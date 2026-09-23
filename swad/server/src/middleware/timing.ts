import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

/**
 * Logs response time for every request.
 * Emits a warning when p95 thresholds are breached.
 */
export function timingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const threshold = isWriteOperation(req.method) ? 3000 : 2000;

    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      correlationId: req.correlationId,
    };

    if (durationMs > threshold) {
      logger.warn('Slow request exceeded threshold', { ...logData, threshold });
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
}

function isWriteOperation(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}
