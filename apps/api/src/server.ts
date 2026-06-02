import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { loadEnv } from './config/env.js';
import { registerErrorHandler } from './plugins/errorHandler.js';
import { registerRoute } from './routes/auth/register.js';
import { loginRoute } from './routes/auth/login.js';
import { refreshRoute } from './routes/auth/refresh.js';
import { logoutRoute } from './routes/auth/logout.js';
import { googleRoute } from './routes/auth/google.js';
import { twoFaRoutes } from './routes/auth/twoFa.js';
import { setupIntentRoute } from './routes/payments/setupIntent.js';
import { paymentMethodsRoutes } from './routes/payments/methods.js';
import { stripeWebhookRoute } from './routes/payments/webhook.js';

async function main() {
  const env = loadEnv();
  const app = Fastify({
    logger: { level: env.NODE_ENV === 'production' ? 'info' : 'debug' },
  });

  await app.register(cookie);
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

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

  // 後續步驟會在此加入: /me (整合測試前補)

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`API listening on ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
