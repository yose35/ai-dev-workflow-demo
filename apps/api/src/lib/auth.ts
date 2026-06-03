// Bearer JWT 驗證 helper — 給需要保護的 route 用
import type { FastifyRequest } from 'fastify';
import { AppError } from './errors.js';
import { verifyAccessToken } from './jwt.js';

export interface AuthedUser {
  userId: string;
  userEmail: string;
}

export async function requireAuth(req: FastifyRequest, secret: string): Promise<AuthedUser> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Missing bearer token');
  }
  const token = header.slice(7).trim();
  try {
    const payload = await verifyAccessToken(token, secret);
    return { userId: payload.sub, userEmail: payload.email };
  } catch {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid token');
  }
}
