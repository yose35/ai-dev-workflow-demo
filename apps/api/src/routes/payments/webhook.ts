// Spec: AC-PAY-2, § 8 webhook idempotency by event.id
// OpenAPI: POST /payments/webhooks/stripe
// 重點：
//  1. 必須驗 Stripe-Signature
//  2. event.id 做 idempotency
//  3. 不收 / 不存卡號 — 只存 PM id + last4 + brand + exp
import type { FastifyInstance } from 'fastify';
import { prisma } from '@pkg/db';
import { getStripe, type Stripe } from '../../lib/stripe.js';
import { alreadyProcessed, markProcessed } from '../../lib/webhookIdempotency.js';
import type { Env } from '../../config/env.js';

export function stripeWebhookRoute(app: FastifyInstance, env: Env) {
  // 需要拿到 raw body 才能算 signature；Fastify 預設會 parse JSON
  // 用 contentTypeParser 留一份 raw body
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    try {
      const json = JSON.parse(body.toString('utf8'));
      (json as any).__rawBody = body;
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.post('/payments/webhooks/stripe', async (req, reply) => {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
      req.log.error('Stripe webhook secret not configured');
      return reply.code(500).send();
    }
    const stripe = getStripe(env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      return reply.code(400).send();
    }

    const rawBody: Buffer | undefined = (req.body as any)?.__rawBody;
    if (!rawBody) {
      return reply.code(400).send();
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (e) {
      req.log.warn({ err: e }, 'Stripe webhook signature verification failed');
      return reply.code(400).send();
    }

    // Idempotency
    if (alreadyProcessed(event.id)) {
      return reply.code(200).send({ ok: true, data: { idempotent: true } });
    }

    try {
      switch (event.type) {
        case 'setup_intent.succeeded':
          await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent, stripe);
          break;
        case 'payment_method.detached':
          await handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
          break;
        default:
          // 其他事件先忽略，但仍記為 processed 避免重送
          break;
      }
      markProcessed(event.id);
      return reply.code(200).send({ ok: true });
    } catch (e) {
      req.log.error({ err: e, event: event.id }, 'Webhook handler failed');
      // 不要 markProcessed → Stripe 會重送
      return reply.code(500).send();
    }
  });
}

async function handleSetupIntentSucceeded(
  intent: Stripe.SetupIntent,
  stripe: Stripe
): Promise<void> {
  const pmId =
    typeof intent.payment_method === 'string'
      ? intent.payment_method
      : intent.payment_method?.id;
  const customerId =
    typeof intent.customer === 'string' ? intent.customer : intent.customer?.id;
  if (!pmId || !customerId) return;

  // 找到對應 user
  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) return;

  // 拉 PM 詳情（last4 / brand / exp）
  const pm = await stripe.paymentMethods.retrieve(pmId);

  // 已存在則略過
  const existing = await prisma.paymentMethod.findUnique({
    where: { stripePaymentMethodId: pmId },
  });
  if (existing) return;

  const card = pm.card;
  await prisma.paymentMethod.create({
    data: {
      userId: user.id,
      stripePaymentMethodId: pmId,
      brand: card?.brand ?? null,
      last4: card?.last4 ?? null,
      expMonth: card?.exp_month ?? null,
      expYear: card?.exp_year ?? null,
      isDefault: false,
    },
  });
}

async function handlePaymentMethodDetached(pm: Stripe.PaymentMethod): Promise<void> {
  await prisma.paymentMethod.deleteMany({
    where: { stripePaymentMethodId: pm.id },
  });
}
