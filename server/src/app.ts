import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { correlationId } from './middleware/correlationId';
import { timingMiddleware } from './middleware/timing';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.routes';
import tenantRoutes from './routes/tenant.routes';

export function createApp() {
  const app = express();

  // ─── Security ──────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true,
      allowedHeaders: [
        'Authorization',
        'Content-Type',
        'X-Correlation-ID',
        'X-Tenant-Slug',
        'Idempotency-Key',
      ],
    }),
  );

  // ─── Rate limiting ─────────────────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests' },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // stricter for auth endpoints
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many authentication attempts' },
  });

  app.use(limiter);

  // ─── Parsing & utilities ───────────────────────────────────────────────────
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(correlationId);
  app.use(timingMiddleware);

  if (config.env !== 'test') {
    app.use(
      morgan('combined', {
        skip: (req) => req.path === '/health',
      }),
    );
  }

  // ─── Health check ──────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ─── Debug endpoint (remove after fixing) ─────────────────────────────────
  app.get('/api/debug', async (_req, res) => {
    const { prisma } = await import('./config/database');
    let dbOk = false;
    let dbError = '';
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch (e) {
      dbError = (e as Error).message;
    }
    res.json({
      env: config.env,
      dbOk,
      dbError,
      corsOrigin: config.cors.origin,
      nodeVersion: process.version,
    });
  });

  // ─── API Routes ────────────────────────────────────────────────────────────
  app.use('/api/v1/auth', authLimiter, authRoutes);
  app.use('/api/v1/tenants', tenantRoutes);

  // ─── Error handler (must be last) ─────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
