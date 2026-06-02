// Spec: AC-PAY-1..5
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { prismaMock, stores, resetStores } from '../auth/__mocks__/prisma.js';
import { signAccessToken } from '../../lib/jwt.js';
import { _resetIdempotency } from '../../lib/webhookIdempotency.js';

vi.mock('@pkg/db', () => ({ prisma: prismaMock }));

// 全部 mock Stripe — 不打真實 API
const stripeCustomerCreate = vi.fn();
const stripeSetupIntentCreate = vi.fn();
const stripePMRetrieve = vi.fn();
const stripePMDetach = vi.fn();
const stripeWebhookConstruct = vi.fn();
const fakeStripe = {
  customers: { create: stripeCustomerCreate },
  setupIntents: { create: stripeSetupIntentCreate },
  paymentMethods: { retrieve: stripePMRetrieve, detach: stripePMDetach },
  webhooks: { constructEvent: stripeWebhookConstruct },
};
vi.mock('../../lib/stripe.js', () => ({
  getStripe: vi.fn(() => fakeStripe),
  _resetStripe: vi.fn(),
}));

const { setupIntentRoute } = await import('./setupIntent.js');
const { paymentMethodsRoutes } = await import('./methods.js');
const { stripeWebhookRoute } = await import('./webhook.js');
const { registerErrorHandler } = await import('../../plugins/errorHandler.js');

const FAKE_ENV = {
  NODE_ENV: 'test' as const,
  PORT: 3000,
  DATABASE_URL: 'postgres://test',
  JWT_SECRET: 'x'.repeat(32),
  JWT_ACCESS_TTL_SEC: 900,
  JWT_REFRESH_TTL_SEC: 2592000,
  STRIPE_SECRET_KEY: 'sk_test_xxx',
  STRIPE_WEBHOOK_SECRET: 'whsec_xxx',
};

async function makeApp(opts: { withSetup?: boolean; withMethods?: boolean; withWebhook?: boolean } = {}) {
  const app = Fastify();
  await app.register(cookie);
  registerErrorHandler(app);
  if (opts.withSetup ?? true) setupIntentRoute(app, FAKE_ENV as any);
  if (opts.withMethods ?? true) paymentMethodsRoutes(app, FAKE_ENV as any);
  if (opts.withWebhook ?? true) stripeWebhookRoute(app, FAKE_ENV as any);
  await app.ready();
  return app;
}

function seedUser(opts: { stripeCustomerId?: string | null } = {}) {
  const id = 'user_1';
  stores.users.set('alice@example.com', {
    id,
    email: 'alice@example.com',
    passwordHash: 'hash',
    totpSecret: null,
    stripeCustomerId: opts.stripeCustomerId ?? null,
    oauthProvider: null,
    oauthSub: null,
    createdAt: new Date(),
  });
  return id;
}

async function authHeader(userId: string) {
  const { token } = await signAccessToken(
    { sub: userId, email: 'alice@example.com' },
    FAKE_ENV.JWT_SECRET,
    FAKE_ENV.JWT_ACCESS_TTL_SEC
  );
  return { authorization: `Bearer ${token}` };
}

describe('POST /payments/setup-intent', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  it('AC-PAY-1: 已登入且未綁過 → 建 Customer + SetupIntent，回 client_secret', async () => {
    const userId = seedUser();
    stripeCustomerCreate.mockResolvedValue({ id: 'cus_NEW' });
    stripeSetupIntentCreate.mockResolvedValue({ client_secret: 'seti_secret_xxx' });
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST', url: '/payments/setup-intent',
      headers: await authHeader(userId),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.client_secret).toBe('seti_secret_xxx');
    expect(stripeCustomerCreate).toHaveBeenCalledOnce();
    expect(stores.users.get('alice@example.com')!.stripeCustomerId).toBe('cus_NEW');
  });

  it('已綁過 Customer → 不重複建立，只開新 SetupIntent', async () => {
    const userId = seedUser({ stripeCustomerId: 'cus_EXISTING' });
    stripeSetupIntentCreate.mockResolvedValue({ client_secret: 'seti_xx' });
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST', url: '/payments/setup-intent',
      headers: await authHeader(userId),
    });
    expect(res.statusCode).toBe(200);
    expect(stripeCustomerCreate).not.toHaveBeenCalled();
  });

  it('未登入 → 401', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/payments/setup-intent' });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /payments/webhooks/stripe', () => {
  beforeEach(() => {
    resetStores();
    _resetIdempotency();
    vi.clearAllMocks();
  });

  it('AC-PAY-2: setup_intent.succeeded → 建立 payment_method 記錄（不存卡號）', async () => {
    seedUser({ stripeCustomerId: 'cus_ABC' });
    stripeWebhookConstruct.mockReturnValue({
      id: 'evt_1',
      type: 'setup_intent.succeeded',
      data: {
        object: {
          payment_method: 'pm_001',
          customer: 'cus_ABC',
        },
      },
    });
    stripePMRetrieve.mockResolvedValue({
      id: 'pm_001',
      card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2029 },
    });
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST', url: '/payments/webhooks/stripe',
      headers: { 'stripe-signature': 'sig', 'content-type': 'application/json' },
      payload: JSON.stringify({ id: 'evt_1' }),
    });
    expect(res.statusCode).toBe(200);
    expect(stores.paymentMethods.length).toBe(1);
    const pm = stores.paymentMethods[0]!;
    expect(pm.brand).toBe('visa');
    expect(pm.last4).toBe('4242');
    // 不應有「卡號」欄位
    expect(JSON.stringify(pm)).not.toMatch(/card_number|number/);
  });

  it('同一 event 重送 → idempotent（不重複建立）', async () => {
    seedUser({ stripeCustomerId: 'cus_ABC' });
    stripeWebhookConstruct.mockReturnValue({
      id: 'evt_dup',
      type: 'setup_intent.succeeded',
      data: { object: { payment_method: 'pm_001', customer: 'cus_ABC' } },
    });
    stripePMRetrieve.mockResolvedValue({
      id: 'pm_001',
      card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2029 },
    });
    const app = await makeApp();
    await app.inject({
      method: 'POST', url: '/payments/webhooks/stripe',
      headers: { 'stripe-signature': 'sig', 'content-type': 'application/json' },
      payload: JSON.stringify({ id: 'evt_dup' }),
    });
    const res2 = await app.inject({
      method: 'POST', url: '/payments/webhooks/stripe',
      headers: { 'stripe-signature': 'sig', 'content-type': 'application/json' },
      payload: JSON.stringify({ id: 'evt_dup' }),
    });
    expect(res2.statusCode).toBe(200);
    expect(stores.paymentMethods.length).toBe(1); // 仍只 1 筆
    // 第二次應該根本沒呼叫 Stripe retrieve
    expect(stripePMRetrieve).toHaveBeenCalledOnce();
  });

  it('signature 無效 → 400', async () => {
    stripeWebhookConstruct.mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST', url: '/payments/webhooks/stripe',
      headers: { 'stripe-signature': 'bad', 'content-type': 'application/json' },
      payload: JSON.stringify({ id: 'evt_x' }),
    });
    expect(res.statusCode).toBe(400);
  });

  it('payment_method.detached → 從 DB 刪除對應紀錄', async () => {
    seedUser({ stripeCustomerId: 'cus_ABC' });
    stores.paymentMethods.push({
      id: 'pm_local_1',
      userId: 'user_1',
      stripePaymentMethodId: 'pm_001',
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2029,
      isDefault: false,
      createdAt: new Date(),
    });
    stripeWebhookConstruct.mockReturnValue({
      id: 'evt_detach_1',
      type: 'payment_method.detached',
      data: { object: { id: 'pm_001' } },
    });
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST', url: '/payments/webhooks/stripe',
      headers: { 'stripe-signature': 'sig', 'content-type': 'application/json' },
      payload: JSON.stringify({ id: 'evt_detach_1' }),
    });
    expect(res.statusCode).toBe(200);
    expect(stores.paymentMethods.length).toBe(0);
  });
});

describe('GET /payments/methods', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  it('AC-PAY-3: 列出本人卡片（不洩漏其他人）', async () => {
    seedUser();
    stores.paymentMethods.push(
      {
        id: 'pm_local_a',
        userId: 'user_1',
        stripePaymentMethodId: 'pm_a',
        brand: 'visa',
        last4: '4242',
        expMonth: 12,
        expYear: 2029,
        isDefault: false,
        createdAt: new Date(),
      },
      {
        id: 'pm_local_other',
        userId: 'user_other',
        stripePaymentMethodId: 'pm_other',
        brand: 'mastercard',
        last4: '5555',
        expMonth: 1,
        expYear: 2030,
        isDefault: false,
        createdAt: new Date(),
      }
    );
    const app = await makeApp();
    const res = await app.inject({
      method: 'GET', url: '/payments/methods',
      headers: await authHeader('user_1'),
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().data;
    expect(list).toHaveLength(1);
    expect(list[0].brand).toBe('visa');
    expect(res.body).not.toMatch(/stripe_payment_method_id|pm_a/);
  });
});

describe('DELETE /payments/methods/:id', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  it('AC-PAY-4: 解除自己的卡 → 204 + Stripe detach + 本地刪除', async () => {
    seedUser();
    stores.paymentMethods.push({
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user_1',
      stripePaymentMethodId: 'pm_xx',
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2029,
      isDefault: false,
      createdAt: new Date(),
    });
    stripePMDetach.mockResolvedValue({ id: 'pm_xx' });
    const app = await makeApp();
    const res = await app.inject({
      method: 'DELETE', url: '/payments/methods/550e8400-e29b-41d4-a716-446655440000',
      headers: await authHeader('user_1'),
    });
    expect(res.statusCode).toBe(204);
    expect(stripePMDetach).toHaveBeenCalledWith('pm_xx');
    expect(stores.paymentMethods).toHaveLength(0);
  });

  it('刪別人的卡 → 404（不洩漏存在性）', async () => {
    seedUser();
    stores.paymentMethods.push({
      id: '550e8400-e29b-41d4-a716-446655440001',
      userId: 'user_other',
      stripePaymentMethodId: 'pm_yy',
      brand: 'visa',
      last4: '0000',
      expMonth: 1,
      expYear: 2030,
      isDefault: false,
      createdAt: new Date(),
    });
    const app = await makeApp();
    const res = await app.inject({
      method: 'DELETE', url: '/payments/methods/550e8400-e29b-41d4-a716-446655440001',
      headers: await authHeader('user_1'),
    });
    expect(res.statusCode).toBe(404);
    expect(stores.paymentMethods).toHaveLength(1);
  });
});
