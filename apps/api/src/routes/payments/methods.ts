// Spec: AC-PAY-3, AC-PAY-4, AC-PAY-5
// OpenAPI: GET /payments/methods + DELETE /payments/methods/:id
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@pkg/db';
import { AppError, errors } from '../../lib/errors.js';
import { requireAuth } from '../../lib/auth.js';
import { getStripe } from '../../lib/stripe.js';
import type { Env } from '../../config/env.js';

const ParamsSchema = z.object({ id: z.string().uuid() });

export function paymentMethodsRoutes(app: FastifyInstance, env: Env) {
  // AC-PAY-3: 列出本人卡片（response 僅含 brand/last4/exp，不含 PCI 敏感資料）
  app.get('/payments/methods', async (req, reply) => {
    const { userId } = await requireAuth(req, env.JWT_SECRET);

    const methods = await prisma.paymentMethod.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({
      ok: true,
      data: methods.map((m: any) => ({
        id: m.id,
        brand: m.brand,
        last4: m.last4,
        exp_month: m.expMonth,
        exp_year: m.expYear,
        is_default: m.isDefault,
      })),
    });
  });

  // AC-PAY-4: 解除綁定（同時 detach Stripe 端）
  app.delete('/payments/methods/:id', async (req, reply) => {
    const { userId } = await requireAuth(req, env.JWT_SECRET);
    const params = ParamsSchema.safeParse(req.params);
    if (!params.success) {
      throw errors.notFound('payment method');
    }
    const { id } = params.data;

    if (!env.STRIPE_SECRET_KEY) {
      throw new AppError('INTERNAL', 500, 'Stripe not configured');
    }
    const stripe = getStripe(env.STRIPE_SECRET_KEY);

    const method = await prisma.paymentMethod.findUnique({ where: { id } });
    if (!method || method.userId !== userId) {
      // 對外統一回 404 不洩漏存在性
      throw errors.notFound('payment method');
    }

    try {
      await stripe.paymentMethods.detach(method.stripePaymentMethodId);
    } catch (e) {
      req.log.warn({ err: e }, 'Stripe detach failed; continuing to delete local record');
    }

    await prisma.paymentMethod.delete({ where: { id } });

    return reply.code(204).send();
  });
}
