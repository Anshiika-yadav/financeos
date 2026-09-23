import { Response } from 'express';
import { ApiResponse } from '../types';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const body: ApiResponse<T> = { success: true, data };
  res.status(statusCode).json(body);
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}

export function sendUnauthorized(res: Response, message = 'Unauthorized'): void {
  const body: ApiResponse = { success: false, error: message };
  res.status(401).json(body);
}

export function sendForbidden(res: Response, message = 'Forbidden'): void {
  const body: ApiResponse = { success: false, error: message };
  res.status(403).json(body);
}

export function sendNotFound(res: Response, message = 'Not found'): void {
  const body: ApiResponse = { success: false, error: message };
  res.status(404).json(body);
}

export function sendBadRequest(res: Response, message: string): void {
  const body: ApiResponse = { success: false, error: message };
  res.status(400).json(body);
}
