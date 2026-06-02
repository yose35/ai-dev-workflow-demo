// Spec: AC-PAY-1
// OpenAPI: POST /payments/setup-intent
import type { FastifyInstance } from 'fastify';
import { prisma } from '@pkg/db';
import { AppError } from '../../lib/errors.js';
import { requireAuth } from '../../lib/auth.js';
import { getStripe } from '../../lib/stripe.js';
import type { Env } from '../../config/env.js';

export function setupIntentRoute(app: FastifyInstance, env: Env) {
  app.post('/payments/setup-intent', async (req, reply) => {
    const { userId, userEmail } = await requireAuth(req, env.JWT_SECRET);

    if (!env.STRIPE_SECRET_KEY) {
      throw new AppError('INTERNAL', 500, 'Stripe not configured');
    }
    const stripe = getStripe(env.STRIPE_SECRET_KEY);

    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('NOT_FOUND', 404, 'User not found');
    }

    // 若尚未建立 Stripe Customer，先建並寫回 DB
    if (!user.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { app_user_id: userId },
      });
      user = await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id },
      });
    }

    const intent = await stripe.setupIntents.create({
      customer: user.stripeCustomerId!,
      usage: 'off_session',
      payment_method_types: ['card'],
      metadata: { app_user_id: userId },
    });

    return reply.send({
      ok: true,
      data: { client_secret: intent.client_secret },
    });
  });
}
