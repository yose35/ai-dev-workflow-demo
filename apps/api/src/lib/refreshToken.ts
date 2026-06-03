// Refresh token 生命週期管理
// 設計依據：ADR-002 refresh-token-strategy
// - 隨機 32 bytes，hex 編碼後給 client（透過 httpOnly cookie）
// - DB 僅存 SHA-256 hash（DB 外洩不直接洩漏 token）
// - rotation：每次 refresh 簽發新 token 並撤銷舊的
// - reuse detection：已撤銷的 token 又出現 → 視為偷竊，撤銷該 user 全部 session
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@pkg/db';

const TOKEN_BYTES = 32;

export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = randomBytes(TOKEN_BYTES).toString('hex');
  const hash = createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function issueRefreshToken(userId: string, ttlSec: number): Promise<string> {
  const { raw, hash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + ttlSec * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hash, expiresAt },
  });
  return raw;
}

export type ConsumeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'REUSED' };

/**
 * 消費並輪換一個 refresh token。
 * 成功時舊 token 立即撤銷、回傳對應 user。
 * 若提交的 token 之前已被撤銷 → 視為偷竊 → 撤銷該 user 所有 active sessions。
 */
export async function consumeRefreshToken(rawToken: string): Promise<ConsumeResult> {
  const hash = hashRefreshToken(rawToken);
  const record = await prisma.refreshToken.findFirst({ where: { tokenHash: hash } });
  if (!record) return { ok: false, reason: 'NOT_FOUND' };

  if (record.revokedAt) {
    // 偷竊偵測：撤銷該 user 所有 active sessions
    await prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: false, reason: 'REUSED' };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'EXPIRED' };
  }

  // 撤銷此 token（rotation 第一步）
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });
  return { ok: true, userId: record.userId };
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeOne(rawToken: string): Promise<void> {
  const hash = hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
