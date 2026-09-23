import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { ApiResponse } from '../types';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

export class UnprocessableError extends AppError {
  constructor(message: string) {
    super(422, message, 'UNPROCESSABLE');
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const correlationId = req.correlationId;

  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.');
      errors[key] = errors[key] ?? [];
      errors[key].push(issue.message);
    }
    const response: ApiResponse = {
      success: false,
      error: 'Validation failed',
      errors,
      correlationId,
    };
    res.status(422).json(response);
    return;
  }

  if (err instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      error: err.message,
      correlationId,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Unexpected errors — don't leak internals
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    correlationId,
  });

  const response: ApiResponse = {
    success: false,
    error: 'An unexpected error occurred',
    correlationId,
  };
  res.status(500).json(response);
}
