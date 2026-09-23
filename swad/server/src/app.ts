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
import glRoutes from './routes/modules/gl.routes';
import apRoutes from './routes/modules/ap.routes';
import arRoutes from './routes/modules/ar.routes';
import treasuryRoutes from './routes/modules/treasury.routes';
import procurementRoutes from './routes/modules/procurement.routes';
import expensesRoutes from './routes/modules/expenses.routes';
import assetsRoutes from './routes/modules/assets.routes';
import inventoryRoutes from './routes/modules/inventory.routes';
import projectsRoutes from './routes/modules/projects.routes';
import budgetingRoutes from './routes/modules/budgeting.routes';
import controlsRoutes from './routes/modules/controls.routes';
import taxRoutes from './routes/modules/tax.routes';
import reportsRoutes from './routes/modules/reports.routes';
import adminRoutes from './routes/modules/admin.routes';
import closeRoutes from './routes/modules/close.routes';
import documentsRoutes from './routes/modules/documents.routes';
import payrollRoutes from './routes/modules/payroll.routes';
import consolidationRoutes from './routes/modules/consolidation.routes';

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
  app.use('/api/v1/gl', glRoutes);
  app.use('/api/v1/ap', apRoutes);
  app.use('/api/v1/ar', arRoutes);
  app.use('/api/v1/treasury', treasuryRoutes);
  app.use('/api/v1/procurement', procurementRoutes);
  app.use('/api/v1/expenses', expensesRoutes);
  app.use('/api/v1/assets', assetsRoutes);
  app.use('/api/v1/inventory', inventoryRoutes);
  app.use('/api/v1/projects', projectsRoutes);
  app.use('/api/v1/budgeting', budgetingRoutes);
  app.use('/api/v1/controls', controlsRoutes);
  app.use('/api/v1/tax', taxRoutes);
  app.use('/api/v1/reports', reportsRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/close', closeRoutes);
  app.use('/api/v1/documents', documentsRoutes);
  app.use('/api/v1/payroll', payrollRoutes);
  app.use('/api/v1/consolidation', consolidationRoutes);

  // ─── Error handler (must be last) ─────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
