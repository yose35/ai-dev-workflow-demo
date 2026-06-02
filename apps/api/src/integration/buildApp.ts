// 整合測試用的 app builder — 把 server.ts 的組裝抽出來方便測試
// 真正的 server.ts main() 仍然會 import 這個 build function
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { registerErrorHandler } from '../plugins/errorHandler.js';
import { registerRoute } from '../routes/auth/register.js';
import { loginRoute } from '../routes/auth/login.js';
import { refreshRoute } from '../routes/auth/refresh.js';
import { logoutRoute } from '../routes/auth/logout.js';
import { googleRoute } from '../routes/auth/google.js';
import { twoFaRoutes } from '../routes/auth/twoFa.js';
import { setupIntentRoute } from '../routes/payments/setupIntent.js';
import { paymentMethodsRoutes } from '../routes/payments/methods.js';
import { stripeWebhookRoute } from '../routes/payments/webhook.js';
import type { Env } from '../config/env.js';

export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.NODE_ENV === 'production' ? 'info' : 'warn' },
  });

  await app.register(cookie);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  registerErrorHandler(app);

  app.get('/health', async () => ({ ok: true, data: { status: 'healthy' } }));

  registerRoute(app, env);
  loginRoute(app, env);
  refreshRoute(app, env);
  logoutRoute(app);
  googleRoute(app, env);
  twoFaRoutes(app, env);
  setupIntentRoute(app, env);
  paymentMethodsRoutes(app, env);
  stripeWebhookRoute(app, env);

  await app.ready();
  return app;
}
