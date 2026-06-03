// Spec: AC-R1 .. AC-R4 — 測試名稱直接帶 AC 編號（CLAUDE.md 慣例）
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { prismaMock, stores, resetStores } from './__mocks__/prisma.js';

vi.mock('@pkg/db', () => ({ prisma: prismaMock }));

const { registerRoute } = await import('./register.js');
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
  registerErrorHandler(app);
  registerRoute(app, FAKE_ENV as any);
  await app.ready();
  return app;
}

describe('POST /auth/register', () => {
  beforeEach(() => resetStores());
  void stores; // silence unused import

  it('AC-R1: 註冊成功 → 201 + access_token + user', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'alice@example.com', password: 'Password123' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.access_token).toMatch(/^eyJ/); // JWT prefix
    expect(body.data.user.email).toBe('alice@example.com');
    expect(body.data.user.two_fa_enabled).toBe(false);
  });

  it('AC-R2: email 已存在 → 409 USER_EXISTS', async () => {
    const app = await makeApp();
    await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'dup@example.com', password: 'Password123' },
    });
    const res = await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'dup@example.com', password: 'Password123' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('USER_EXISTS');
  });

  it('AC-R3a: 密碼少於 10 字 → 400 WEAK_PASSWORD', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'a@b.com', password: 'Short1' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('WEAK_PASSWORD');
  });

  it('AC-R3b: 密碼無數字 → 400 WEAK_PASSWORD', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'a@b.com', password: 'NoDigitsHere' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('WEAK_PASSWORD');
  });

  it('AC-R4: email 格式錯 → 400 INVALID_EMAIL', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'not-an-email', password: 'Password123' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_EMAIL');
  });

  it('安全：response 不含 password_hash', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'safe@example.com', password: 'Password123' },
    });
    const txt = res.body;
    expect(txt).not.toMatch(/password_hash|passwordHash/);
  });
});
