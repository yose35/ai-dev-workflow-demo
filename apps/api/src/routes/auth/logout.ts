// OpenAPI: POST /auth/logout
import type { FastifyInstance } from 'fastify';
import { revokeOne } from '../../lib/refreshToken.js';

const REFRESH_COOKIE = 'refresh_token';

export function logoutRoute(app: FastifyInstance) {
  app.post('/auth/logout', async (req, reply) => {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (raw) {
      await revokeOne(raw);
    }
    return reply
      .clearCookie(REFRESH_COOKIE, { path: '/auth' })
      .code(204)
      .send();
  });
}
