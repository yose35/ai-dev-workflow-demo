// Spec: AC-L4 + refresh token rotation + reuse detection（依 ADR-002）
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { prismaMock, stores, resetStores } from './__mocks__/prisma.js';
import { issueRefreshToken } from '../../lib/refreshToken.js';

vi.mock('@pkg/db', () => ({ prisma: prismaMock }));

const { refreshRoute } = await import('./refresh.js');
const { registerErrorHandler } = await import('../../plugins/errorHandler.js');

const FAKE_ENV = {
  NODE_ENV: 'test' as const,
  PORT: 3000,
  DATABASE_URL: 'postgres://test',
  JWT_SECRET: 'x'.repeat(32),
  JWT_ACCESS_TTL_SEC: 900,
  JWT_REFRESH_TTL_SEC: 2592000,
};

async function makeApp() {
  const app = Fastify();
  await app.register(cookie);
  registerErrorHandler(app);
  refreshRoute(app, FAKE_ENV as any);
  await app.ready();
  return app;
}

function seedUser() {
  const userId = `user_1`;
  stores.users.set('a@b.com', {
    id: userId,
    email: 'a@b.com',
    passwordHash: 'fakehash',
    totpSecret: null,
    stripeCustomerId: null,
    createdAt: new Date(),
  });
  return userId;
}

describe('POST /auth/refresh', () => {
  beforeEach(() => resetStores());

  it('AC-L4: 有效 refresh → 200 + 新 access + rotate refresh cookie', async () => {
    const userId = seedUser();
    const raw = await issueRefreshToken(userId, 2592000);
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST', url: '/auth/refresh',
      cookies: { refresh_token: raw },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.access_token).toMatch(/^eyJ/);
    // 應收到新 cookie
    expect(String(res.headers['set-cookie'])).toMatch(/refresh_token=/);
    // DB 應有 2 筆 refresh：舊的已 revoked、新的 active
    expect(stores.refreshTokens.length).toBe(2);
    expect(stores.refreshTokens[0]!.revokedAt).not.toBeNull();
    expect(stores.refreshTokens[1]!.revokedAt).toBeNull();
  });

  it('沒帶 cookie → 401', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/auth/refresh' });
    expect(res.statusCode).toBe(401);
  });

  it('已被撤銷的 refresh 再次使用 → 401 + 該 user 所有 session 全撤銷（reuse detection）', async () => {
    const userId = seedUser();
    const tokenA = await issueRefreshToken(userId, 2592000);
    const tokenB = await issueRefreshToken(userId, 2592000); // 同 user 第二個 active session
    const app = await makeApp();

    // 用 tokenA 一次（正常）→ tokenA 被 rotate 並 revoke
    await app.inject({ method: 'POST', url: '/auth/refresh', cookies: { refresh_token: tokenA } });
    // 再用 tokenA（攻擊者搶先用了竊得的 token）→ 偷竊偵測
    const res = await app.inject({ method: 'POST', url: '/auth/refresh', cookies: { refresh_token: tokenA } });
    expect(res.statusCode).toBe(401);

    // tokenB 也應該被撤銷（reuse detection 撤銷該 user 所有 active sessions）
    expect(stores.refreshTokens.every((r) => r.revokedAt !== null)).toBe(true);
    void tokenB; // silence unused
  });
});
