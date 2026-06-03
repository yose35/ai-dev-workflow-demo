// Spec: AC-2FA-1, AC-2FA-2
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authenticator } from 'otplib';
import { prismaMock, stores, resetStores } from './__mocks__/prisma.js';
import { signAccessToken } from '../../lib/jwt.js';
import { issueChallenge } from '../../lib/twoFaChallenge.js';

vi.mock('@pkg/db', () => ({ prisma: prismaMock }));

const { twoFaRoutes } = await import('./twoFa.js');
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
  twoFaRoutes(app, FAKE_ENV as any);
  await app.ready();
  return app;
}

function seedUser(opts: { id?: string; totpSecret?: string | null } = {}) {
  const id = opts.id ?? 'user_1';
  stores.users.set('alice@example.com', {
    id,
    email: 'alice@example.com',
    passwordHash: 'hash',
    totpSecret: opts.totpSecret ?? null,
    stripeCustomerId: null,
    oauthProvider: null,
    oauthSub: null,
    createdAt: new Date(),
  });
  return id;
}

async function authHeaderFor(userId: string) {
  const { token } = await signAccessToken(
    { sub: userId, email: 'alice@example.com' },
    FAKE_ENV.JWT_SECRET,
    FAKE_ENV.JWT_ACCESS_TTL_SEC
  );
  return { authorization: `Bearer ${token}` };
}

describe('POST /auth/2fa/enroll', () => {
  beforeEach(() => resetStores());

  it('AC-2FA-1: 已登入 → 回 secret + qr_data，DB 寫入 totpSecret', async () => {
    const userId = seedUser();
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/2fa/enroll',
      headers: await authHeaderFor(userId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.secret).toMatch(/^[A-Z2-7]+$/); // base32
    expect(body.data.qr_data).toMatch(/^data:image\/png;base64,/);
    expect(stores.users.get('alice@example.com')!.totpSecret).toBeTruthy();
  });

  it('未登入 → 401', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/auth/2fa/enroll' });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /auth/2fa/verify', () => {
  beforeEach(() => resetStores());

  it('AC-2FA-2 login flow: 正確 code + 有效 challenge → 200 + tokens', async () => {
    const secret = authenticator.generateSecret();
    const userId = seedUser({ totpSecret: secret });
    const challenge_id = issueChallenge(userId, FAKE_ENV.JWT_SECRET);
    const code = authenticator.generate(secret);
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/2fa/verify',
      payload: { code, challenge_id },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.access_token).toMatch(/^eyJ/);
    expect(body.data.user.two_fa_enabled).toBe(true);
    expect(String(res.headers['set-cookie'])).toMatch(/refresh_token=/);
  });

  it('login flow: code 錯誤 → 401 INVALID_2FA_CODE', async () => {
    const secret = authenticator.generateSecret();
    const userId = seedUser({ totpSecret: secret });
    const challenge_id = issueChallenge(userId, FAKE_ENV.JWT_SECRET);
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/2fa/verify',
      payload: { code: '000000', challenge_id },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_2FA_CODE');
  });

  it('login flow: 偽造 challenge → 401', async () => {
    const secret = authenticator.generateSecret();
    seedUser({ totpSecret: secret });
    const code = authenticator.generate(secret);
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/2fa/verify',
      payload: { code, challenge_id: '2fa.bad.user_1.9999999999.dead' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_2FA_CODE');
  });

  it('confirm enrollment（已登入無 challenge_id）: 正確 code → 200 two_fa_enabled', async () => {
    const secret = authenticator.generateSecret();
    const userId = seedUser({ totpSecret: secret });
    const code = authenticator.generate(secret);
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/2fa/verify',
      headers: await authHeaderFor(userId),
      payload: { code },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.two_fa_enabled).toBe(true);
  });

  it('confirm enrollment: 未登入 → 401', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/2fa/verify',
      payload: { code: '123456' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('code 格式錯（非 6 位數字）→ 401', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/2fa/verify',
      payload: { code: 'abcdef', challenge_id: 'whatever' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_2FA_CODE');
  });
});
