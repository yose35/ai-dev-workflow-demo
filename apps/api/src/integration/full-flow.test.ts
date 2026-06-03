// 完整 happy path 整合測試（PLAN.md 步驟 8）
// 流程：register → login → enroll 2FA → re-login + 2FA → bind card → list → unbind
// Stripe / Prisma 仍 mock，但全部 routes 一起跑，驗證模組間銜接無誤
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authenticator } from 'otplib';
import { prismaMock, stores, resetStores } from '../routes/auth/__mocks__/prisma.js';
import { _resetIdempotency } from '../lib/webhookIdempotency.js';

vi.mock('@pkg/db', () => ({ prisma: prismaMock }));

// Stripe mock
const stripeCustomerCreate = vi.fn();
const stripeSetupIntentCreate = vi.fn();
const stripePMRetrieve = vi.fn();
const stripePMDetach = vi.fn();
const stripeWebhookConstruct = vi.fn();
vi.mock('../lib/stripe.js', () => ({
  getStripe: vi.fn(() => ({
    customers: { create: stripeCustomerCreate },
    setupIntents: { create: stripeSetupIntentCreate },
    paymentMethods: { retrieve: stripePMRetrieve, detach: stripePMDetach },
    webhooks: { constructEvent: stripeWebhookConstruct },
  })),
  _resetStripe: vi.fn(),
}));

// Google OAuth mock（避免打到真實 API）
vi.mock('../lib/googleOAuth.js', () => ({
  verifyGoogleIdToken: vi.fn(),
}));

const FAKE_ENV = {
  NODE_ENV: 'test' as const,
  PORT: 3000,
  DATABASE_URL: 'postgres://test',
  JWT_SECRET: 'x'.repeat(32),
  JWT_ACCESS_TTL_SEC: 900,
  JWT_REFRESH_TTL_SEC: 2592000,
  STRIPE_SECRET_KEY: 'sk_test_xxx',
  STRIPE_WEBHOOK_SECRET: 'whsec_xxx',
  GOOGLE_OAUTH_CLIENT_ID: 'demo.apps.googleusercontent.com',
};

let app: FastifyInstance;

describe('End-to-end happy path', () => {
  beforeAll(async () => {
    const { buildApp } = await import('./buildApp.js');
    app = await buildApp(FAKE_ENV as any);
  });

  beforeEach(() => {
    resetStores();
    _resetIdempotency();
    vi.clearAllMocks();
  });

  it('完整流程：register → login → 2FA → 綁卡 → 列表 → 解綁', async () => {
    // ── (1) 註冊新使用者 ─────────────────────────────────────
    const reg = await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'alice@example.com', password: 'Password123' },
    });
    expect(reg.statusCode).toBe(201);
    const regBody = reg.json();
    expect(regBody.data.access_token).toMatch(/^eyJ/);
    const userId = regBody.data.user.id;

    // ── (2) 用 email/密碼 login（尚未啟用 2FA）─────────────
    const login1 = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'alice@example.com', password: 'Password123' },
    });
    expect(login1.statusCode).toBe(200);
    const accessToken1 = login1.json().data.access_token;
    expect(accessToken1).toMatch(/^eyJ/);

    // ── (3) 啟用 2FA ──────────────────────────────────────
    const enroll = await app.inject({
      method: 'POST', url: '/auth/2fa/enroll',
      headers: { authorization: `Bearer ${accessToken1}` },
    });
    expect(enroll.statusCode).toBe(200);
    const totpSecret = enroll.json().data.secret as string;
    expect(totpSecret).toBeTruthy();
    expect(enroll.json().data.qr_data).toMatch(/^data:image\/png;base64,/);

    // ── (4) 再次 login → 應被要求 2FA ───────────────────────
    const login2 = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'alice@example.com', password: 'Password123' },
    });
    expect(login2.statusCode).toBe(202);
    const challenge_id = login2.json().error.challenge_id as string;
    expect(challenge_id).toBeTruthy();
    expect(challenge_id).not.toBe(userId); // 不是裸 userId

    // ── (5) 用 TOTP code 完成 login ───────────────────────
    const code = authenticator.generate(totpSecret);
    const verify = await app.inject({
      method: 'POST', url: '/auth/2fa/verify',
      payload: { code, challenge_id },
    });
    expect(verify.statusCode).toBe(200);
    const accessToken2 = verify.json().data.access_token;
    expect(verify.json().data.user.two_fa_enabled).toBe(true);

    // ── (6) 建 SetupIntent ────────────────────────────────
    stripeCustomerCreate.mockResolvedValueOnce({ id: 'cus_INT_1' });
    stripeSetupIntentCreate.mockResolvedValueOnce({ client_secret: 'seti_secret_int' });
    const intent = await app.inject({
      method: 'POST', url: '/payments/setup-intent',
      headers: { authorization: `Bearer ${accessToken2}` },
    });
    expect(intent.statusCode).toBe(200);
    expect(intent.json().data.client_secret).toBe('seti_secret_int');

    // ── (7) Stripe webhook：模擬 setup_intent.succeeded ──
    stripeWebhookConstruct.mockReturnValueOnce({
      id: 'evt_int_1',
      type: 'setup_intent.succeeded',
      data: {
        object: { payment_method: 'pm_int_1', customer: 'cus_INT_1' },
      },
    });
    stripePMRetrieve.mockResolvedValueOnce({
      id: 'pm_int_1',
      card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
    });
    const webhook = await app.inject({
      method: 'POST', url: '/payments/webhooks/stripe',
      headers: { 'stripe-signature': 'sig', 'content-type': 'application/json' },
      payload: JSON.stringify({ id: 'evt_int_1' }),
    });
    expect(webhook.statusCode).toBe(200);

    // ── (8) GET 卡片列表 → 應有 1 張 visa 4242 ─────────────
    const list1 = await app.inject({
      method: 'GET', url: '/payments/methods',
      headers: { authorization: `Bearer ${accessToken2}` },
    });
    expect(list1.statusCode).toBe(200);
    const cards = list1.json().data;
    expect(cards).toHaveLength(1);
    expect(cards[0].brand).toBe('visa');
    expect(cards[0].last4).toBe('4242');
    expect(cards[0].exp_month).toBe(12);
    expect(cards[0].exp_year).toBe(2030);
    // 不洩漏內部 id
    expect(list1.body).not.toMatch(/stripe_payment_method_id|pm_int_1/);

    // ── (9) DELETE 該卡 → 204 + Stripe detach 被呼叫 ────────
    stripePMDetach.mockResolvedValueOnce({ id: 'pm_int_1' });
    const del = await app.inject({
      method: 'DELETE', url: `/payments/methods/${cards[0].id}`,
      headers: { authorization: `Bearer ${accessToken2}` },
    });
    expect(del.statusCode).toBe(204);
    expect(stripePMDetach).toHaveBeenCalledWith('pm_int_1');

    // ── (10) 列表應為空 ──────────────────────────────────
    const list2 = await app.inject({
      method: 'GET', url: '/payments/methods',
      headers: { authorization: `Bearer ${accessToken2}` },
    });
    expect(list2.statusCode).toBe(200);
    expect(list2.json().data).toHaveLength(0);
  });

  it('安全：access_token 被竄改 → 所有 protected route 一律 401', async () => {
    const probes = [
      { method: 'POST' as const, url: '/auth/2fa/enroll' },
      { method: 'POST' as const, url: '/payments/setup-intent' },
      { method: 'GET' as const, url: '/payments/methods' },
    ];
    for (const p of probes) {
      const res = await app.inject({
        ...p,
        headers: { authorization: 'Bearer tampered.token.value' },
      });
      expect(res.statusCode).toBe(401);
    }
  });

  it('安全：health 是 public，不需 auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('healthy');
  });

  it('安全：response body 整路不洩漏 password_hash / token_hash / oauth_sub', async () => {
    void stores; // 確保 mock 被引用
    const reg = await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'safe@example.com', password: 'Password123' },
    });
    expect(reg.body).not.toMatch(/password_hash|passwordHash|token_hash|tokenHash|oauth_sub/);
  });
});
