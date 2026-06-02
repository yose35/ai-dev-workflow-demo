// Spec: AC-L3 + state CSRF
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { prismaMock, stores, resetStores } from './__mocks__/prisma.js';
import { issueState } from '../../lib/csrfState.js';

vi.mock('@pkg/db', () => ({ prisma: prismaMock }));

// Mock google-auth-library — 不打真實 Google
vi.mock('../../lib/googleOAuth.js', () => ({
  verifyGoogleIdToken: vi.fn(),
}));

const { googleRoute } = await import('./google.js');
const { registerErrorHandler } = await import('../../plugins/errorHandler.js');
const { verifyGoogleIdToken } = await import('../../lib/googleOAuth.js');

const FAKE_ENV = {
  NODE_ENV: 'test' as const,
  PORT: 3000,
  DATABASE_URL: 'postgres://test',
  JWT_SECRET: 'x'.repeat(32),
  JWT_ACCESS_TTL_SEC: 900,
  JWT_REFRESH_TTL_SEC: 2592000,
  GOOGLE_OAUTH_CLIENT_ID: 'demo-client-id.apps.googleusercontent.com',
};

async function makeApp() {
  const app = Fastify();
  await app.register(cookie);
  registerErrorHandler(app);
  googleRoute(app, FAKE_ENV as any);
  await app.ready();
  return app;
}

const VALID_PROFILE = {
  sub: 'google-user-12345',
  email: 'alice@example.com',
  email_verified: true,
};

describe('GET /auth/google/state', () => {
  beforeEach(() => resetStores());

  it('回傳 state token（格式 nonce.exp.sig）', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/auth/google/state' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.state).toMatch(/^[a-f0-9]+\.\d+\.[a-f0-9]+$/);
  });
});

describe('POST /auth/google', () => {
  beforeEach(() => {
    resetStores();
    vi.mocked(verifyGoogleIdToken).mockReset();
  });

  it('AC-L3a: 新 Google 使用者 → 201/200 + 建立 user + 設 refresh cookie', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue(VALID_PROFILE);
    const app = await makeApp();
    const state = issueState(FAKE_ENV.JWT_SECRET);
    const res = await app.inject({
      method: 'POST', url: '/auth/google',
      payload: { id_token: 'fake-id-token-xx', state },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.user.email).toBe('alice@example.com');
    expect(stores.users.size).toBe(1);
    const u = stores.users.get('alice@example.com')!;
    expect(u.oauthProvider).toBe('google');
    expect(u.oauthSub).toBe('google-user-12345');
  });

  it('AC-L3b: 既有 Google user（同 sub）→ 200 不再建新 user', async () => {
    // 預先放一個已連結 Google 的 user
    stores.users.set('alice@example.com', {
      id: 'user_existing',
      email: 'alice@example.com',
      passwordHash: null,
      totpSecret: null,
      stripeCustomerId: null,
      oauthProvider: 'google',
      oauthSub: 'google-user-12345',
      createdAt: new Date(),
    });
    vi.mocked(verifyGoogleIdToken).mockResolvedValue(VALID_PROFILE);
    const app = await makeApp();
    const state = issueState(FAKE_ENV.JWT_SECRET);
    const res = await app.inject({
      method: 'POST', url: '/auth/google',
      payload: { id_token: 'fake-id-token-xx', state },
    });
    expect(res.statusCode).toBe(200);
    expect(stores.users.size).toBe(1);
    expect(res.json().data.user.id).toBe('user_existing');
  });

  it('AC-L3c: 既有 email 但無 oauth → 連結 Google 到既有帳號', async () => {
    stores.users.set('alice@example.com', {
      id: 'user_password',
      email: 'alice@example.com',
      passwordHash: 'hash',
      totpSecret: null,
      stripeCustomerId: null,
      oauthProvider: null,
      oauthSub: null,
      createdAt: new Date(),
    });
    vi.mocked(verifyGoogleIdToken).mockResolvedValue(VALID_PROFILE);
    const app = await makeApp();
    const state = issueState(FAKE_ENV.JWT_SECRET);
    const res = await app.inject({
      method: 'POST', url: '/auth/google',
      payload: { id_token: 'fake-id-token-xx', state },
    });
    expect(res.statusCode).toBe(200);
    const u = stores.users.get('alice@example.com')!;
    expect(u.id).toBe('user_password');
    expect(u.oauthProvider).toBe('google');
    expect(u.oauthSub).toBe('google-user-12345');
  });

  it('state 錯誤 → 401 OAUTH_STATE_INVALID', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST', url: '/auth/google',
      payload: { id_token: 'fake-id-token-xx', state: 'bogus.123.deadbeef' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('OAUTH_STATE_INVALID');
  });

  it('id_token 驗證失敗 → 401 OAUTH_STATE_INVALID', async () => {
    vi.mocked(verifyGoogleIdToken).mockRejectedValue(new Error('bad signature'));
    const app = await makeApp();
    const state = issueState(FAKE_ENV.JWT_SECRET);
    const res = await app.inject({
      method: 'POST', url: '/auth/google',
      payload: { id_token: 'fake-id-token-xx', state },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('OAUTH_STATE_INVALID');
  });

  it('安全：response 不含 password_hash / oauth_sub', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue(VALID_PROFILE);
    const app = await makeApp();
    const state = issueState(FAKE_ENV.JWT_SECRET);
    const res = await app.inject({
      method: 'POST', url: '/auth/google',
      payload: { id_token: 'fake-id-token-xx', state },
    });
    expect(res.body).not.toMatch(/password_hash|passwordHash|oauth_sub/);
  });
});
