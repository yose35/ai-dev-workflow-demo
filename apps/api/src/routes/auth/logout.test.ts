import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { prismaMock, stores, resetStores } from './__mocks__/prisma.js';
import { issueRefreshToken } from '../../lib/refreshToken.js';

vi.mock('@pkg/db', () => ({ prisma: prismaMock }));

const { logoutRoute } = await import('./logout.js');

async function makeApp() {
  const app = Fastify();
  await app.register(cookie);
  logoutRoute(app);
  await app.ready();
  return app;
}

describe('POST /auth/logout', () => {
  beforeEach(() => resetStores());

  it('帶有效 refresh → 204 + token 被 revoke + cookie 被 clear', async () => {
    const raw = await issueRefreshToken('user_1', 2592000);
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST', url: '/auth/logout',
      cookies: { refresh_token: raw },
    });
    expect(res.statusCode).toBe(204);
    expect(stores.refreshTokens[0]!.revokedAt).not.toBeNull();
    expect(String(res.headers['set-cookie'])).toMatch(/refresh_token=;/); // cleared
  });

  it('沒帶 cookie → 仍回 204（idempotent）', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/auth/logout' });
    expect(res.statusCode).toBe(204);
  });
});
