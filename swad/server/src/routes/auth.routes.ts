import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service';
import { sendSuccess, sendCreated } from '../utils/response';

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/signup
 */
router.post(
  '/signup',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = signUpSchema.parse(req.body);
      const result = await authService.signUp(body);
      sendCreated(res, result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/auth/login
 */
router.post(
  '/login',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = loginSchema.parse(req.body);
      const tokens = await authService.login(body, req.correlationId);
      sendSuccess(res, tokens);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/auth/refresh
 */
router.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      const tokens = await authService.refreshTokens(refreshToken);
      sendSuccess(res, tokens);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/auth/logout
 */
router.post(
  '/logout',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      await authService.logout(refreshToken);
      sendSuccess(res, { message: 'Logged out' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
