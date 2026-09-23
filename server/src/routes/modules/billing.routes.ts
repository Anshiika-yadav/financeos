import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// GET /api/v1/billing/subscription - Get tenant plan & usage limits
router.get('/subscription', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({
      success: true,
      plan: 'Enterprise Tier',
      seatsAllocated: 25,
      seatsUsed: 18,
      status: 'ACTIVE'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/billing/usage - Log usage metrics (e.g., OCR pages processed)
router.post('/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { metric, quantity } = req.body;
    // TODO: Record usage event into platform metering engine
    res.status(201).json({ success: true, metric, trackedQuantity: quantity });
  } catch (error) {
    next(error);
  }
});

export default router;