// Spec: AC-L4
// OpenAPI: POST /auth/refresh
import type { FastifyInstance } from 'fastify';
import { prisma } from '@pkg/db';
import { errors } from '../../lib/errors.js';
import { signAccessToken } from '../../lib/jwt.js';
import { consumeRefreshToken, issueRefreshToken } from '../../lib/refreshToken.js';
import type { Env } from '../../config/env.js';

const REFRESH_COOKIE = 'refresh_token';

export function refreshRoute(app: FastifyInstance, env: Env) {
  app.post('/auth/refresh', async (req, reply) => {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) {
      throw errors.invalidCredentials();
    }

    const consumed = await consumeRefreshToken(raw);
    if (!consumed.ok) {
      // 被偷竊偵測或失效 → 清 cookie
      reply.clearCookie(REFRESH_COOKIE, { path: '/auth' });
      throw errors.invalidCredentials();
    }

    const user = await prisma.user.findUnique({ where: { id: consumed.userId } });
    if (!user) {
      throw errors.invalidCredentials();
    }

    // 簽新的 access + rotate refresh
    const { token: accessToken, expiresIn } = await signAccessToken(
      { sub: user.id, email: user.email },
      env.JWT_SECRET,
      env.JWT_ACCESS_TTL_SEC
    );
    const newRefresh = await issueRefreshToken(user.id, env.JWT_REFRESH_TTL_SEC);

    return reply
      .setCookie(REFRESH_COOKIE, newRefresh, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/auth',
        maxAge: env.JWT_REFRESH_TTL_SEC,
      })
      .code(200)
      .send({
        ok: true,
        data: { access_token: accessToken, expires_in: expiresIn },
      });
  });
}
