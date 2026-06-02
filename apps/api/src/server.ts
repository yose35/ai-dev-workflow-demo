import { loadEnv } from './config/env.js';
import { buildApp } from './integration/buildApp.js';

async function main() {
  const env = loadEnv();
  const app = await buildApp(env);

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`API listening on ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
