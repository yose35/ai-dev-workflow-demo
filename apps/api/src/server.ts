import { loadEnv } from './config/env.js';
import { initSentry, Sentry } from './lib/sentry.js';
import { logger } from './lib/logger.js';
import { buildApp } from './integration/buildApp.js';

async function main() {
  const env = loadEnv();
  initSentry(env);

  const app = await buildApp(env);

  // 全域未捕獲錯誤 → Sentry
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException');
    Sentry.captureException(err);
    setTimeout(() => process.exit(1), 1000);
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'unhandledRejection');
    Sentry.captureException(reason);
  });

  // graceful shutdown
  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.on(sig, async () => {
      logger.info({ sig }, 'shutting down');
      await app.close();
      await Sentry.close(2000);
      process.exit(0);
    });
  }

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info({ port: env.PORT }, `API listening on ${env.PORT}`);
  } catch (err) {
    logger.error({ err }, 'failed to start');
    Sentry.captureException(err);
    process.exit(1);
  }
}

main();
