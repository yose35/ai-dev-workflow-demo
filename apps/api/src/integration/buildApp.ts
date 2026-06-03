// 整合測試用的 app builder — 把 server.ts 的組裝抽出來方便測試
// 真正的 server.ts main() 仍然會 import 這個 build function
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
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
import { metricsRoutes } from '../routes/metrics/metrics.js';
import { loggerOptions } from '../lib/logger.js';
import type { Env } from '../config/env.js';

export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    // 傳 options（不是 instance）讓 Fastify 自己建 pino，避免型別污染 FastifyInstance
    logger: env.NODE_ENV === 'test' ? false : loggerOptions,
    disableRequestLogging: env.NODE_ENV === 'test',
    // production 受信任 proxy header（給 rate limit 拿真實 IP）
    trustProxy: env.NODE_ENV === 'production',
  });

  // ── Security ─────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: false, // FE 走 Next.js 自己設定
  });
  await app.register(cors, {
    // 預設值給整合測試 / 沒設 env 的情境用
    origin: (env.CORS_ORIGIN ?? 'http://localhost:3001')
      .split(',')
      .map((s) => s.trim()),
    credentials: true,
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
  metricsRoutes(app, env);

  await app.ready();
  return app;
}
