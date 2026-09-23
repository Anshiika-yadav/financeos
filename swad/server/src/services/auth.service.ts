import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { config } from '../config';
import { writeAuditLog } from './audit.service';
import { AppError, ConflictError } from '../middleware/errorHandler';
import { PlatformRole } from '../types';

interface SignUpInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

function signAccessToken(userId: string, email: string, platformRole?: PlatformRole): string {
  return jwt.sign(
    { sub: userId, email, platformRole },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn } as jwt.SignOptions,
  );
}

async function createRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(
    Date.now() + parseDuration(config.jwt.refreshExpiresIn),
  );

  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return raw;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function signUp(input: SignUpInput): Promise<{ userId: string }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError('Email already in use');

  const passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
    },
  });

  return { userId: user.id };
}

export async function login(
  input: LoginInput,
  correlationId?: string,
): Promise<TokenPair> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive) {
    throw new AppError(401, 'Invalid credentials');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Audit the sign-in. Use the first tenant membership for context if available.
  const membership = await prisma.tenantUser.findFirst({
    where: { userId: user.id, isActive: true },
    select: { tenantId: true },
  });

  if (membership) {
    await writeAuditLog({
      tenantId: membership.tenantId,
      actorId: user.id,
      action: 'login',
      resourceType: 'user',
      resourceId: user.id,
      correlationId,
    });
  }

  const accessToken = signAccessToken(
    user.id,
    user.email,
    user.platformRole as PlatformRole | undefined,
  );
  const refreshToken = await createRefreshToken(user.id);

  return { accessToken, refreshToken };
}

export async function refreshTokens(rawToken: string): Promise<TokenPair> {
  const tokenHash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  // Rotate: revoke old, issue new
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: stored.userId } });

  const accessToken = signAccessToken(
    user.id,
    user.email,
    user.platformRole as PlatformRole | undefined,
  );
  const newRefreshToken = await createRefreshToken(user.id);

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(rawToken: string): Promise<void> {
  const tokenHash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revokedAt: new Date() },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * multipliers[unit];
}
