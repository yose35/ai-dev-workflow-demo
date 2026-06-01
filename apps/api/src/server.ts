import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { loadEnv } from './config/env.js';
import { registerRoute } from './routes/auth/register.js';

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

  app.get('/health', async () => ({ ok: true, data: { status: 'healthy' } }));

  registerRoute(app, env);

  // 後續步驟會在此加入: /auth/login, /auth/refresh, /auth/google, /auth/2fa/*, /me, /payments/*

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`API listening on ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
