// Spec: AC-L1, AC-L2 + 安全測試
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { prismaMock, stores, resetStores } from './__mocks__/prisma.js';
import { hashPassword } from '../../lib/password.js';
import { _clearAll as clearRateLimit } from '../../lib/rateLimit.js';

vi.mock('@pkg/db', () => ({ prisma: prismaMock }));

const { loginRoute } = await import('./login.js');
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
  loginRoute(app, FAKE_ENV as any);
  await app.ready();
  return app;
}

async function seedUser(email = 'alice@example.com', password = 'Password123') {
  stores.users.set(email, {
    id: `user_${stores.users.size + 1}`,
    email,
    passwordHash: await hashPassword(password),
    totpSecret: null,
    stripeCustomerId: null,
    oauthProvider: null,
    oauthSub: null,
    createdAt: new Date(),
  });
}

describe('POST /auth/login', () => {
  beforeEach(() => {
    resetStores();
    clearRateLimit();
  });

  it('AC-L1: 正確帳密 → 200 + access_token + 設定 refresh cookie', async () => {
    await seedUser();
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'alice@example.com', password: 'Password123' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.access_token).toMatch(/^eyJ/);
    const setCookie = res.headers['set-cookie'];
    expect(String(setCookie)).toMatch(/refresh_token=/);
    expect(String(setCookie)).toMatch(/HttpOnly/i);
    expect(String(setCookie)).toMatch(/SameSite=Strict/i);
  });

  it('AC-L2a: 密碼錯誤 → 401 INVALID_CREDENTIALS', async () => {
    await seedUser();
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'alice@example.com', password: 'WrongPass1' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('AC-L2b: 連續 6 次失敗 → 第 6 次回 429 RATE_LIMITED', async () => {
    await seedUser();
    const app = await makeApp();
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST', url: '/auth/login',
        payload: { email: 'alice@example.com', password: 'WrongPass1' },
      });
    }
    const res = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'alice@example.com', password: 'Password123' },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('RATE_LIMITED');
  });

  it('帳號不存在 → 401（不洩漏存在性）', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'nobody@example.com', password: 'Password123' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('安全：response 不含 password_hash', async () => {
    await seedUser();
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'alice@example.com', password: 'Password123' },
    });
    expect(res.body).not.toMatch(/password_hash|passwordHash/);
  });
});
