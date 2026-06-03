// Spec: AC-L1, AC-L2
// OpenAPI: POST /auth/login
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@pkg/db';
import { errors } from '../../lib/errors.js';
import { verifyPassword } from '../../lib/password.js';
import { signAccessToken } from '../../lib/jwt.js';
import { issueRefreshToken } from '../../lib/refreshToken.js';
import { checkLoginAttempt, resetLoginAttempts } from '../../lib/rateLimit.js';
import { issueChallenge } from '../../lib/twoFaChallenge.js';
import type { Env } from '../../config/env.js';

const Body = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1),
});

const REFRESH_COOKIE = 'refresh_token';

export function loginRoute(app: FastifyInstance, env: Env) {
  app.post('/auth/login', async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      throw errors.invalidCredentials();
    }
    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // ── AC-L2: rate limit ────────────────────────────────────
    const rlKey = `${req.ip}:${normalizedEmail}`;
    const rl = checkLoginAttempt(rlKey);
    if (!rl.ok) {
      throw errors.rateLimited();
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.passwordHash) {
      throw errors.invalidCredentials();
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      throw errors.invalidCredentials();
    }

    resetLoginAttempts(rlKey);

    // AC-2FA-2: 若啟用 2FA → 回 202 + 簽 challenge_id（HMAC，5min TTL）
    if (user.totpSecret) {
      const challenge_id = issueChallenge(user.id, env.JWT_SECRET);
      return reply.code(202).send({
        ok: false,
        error: { code: 'TWO_FA_REQUIRED', message: '', challenge_id },
      });
    }

    // ── AC-L1: 簽發 access + refresh ─────────────────────────
    const { token: accessToken, expiresIn } = await signAccessToken(
      { sub: user.id, email: user.email },
      env.JWT_SECRET,
      env.JWT_ACCESS_TTL_SEC
    );
    const refreshRaw = await issueRefreshToken(user.id, env.JWT_REFRESH_TTL_SEC);

    return reply
      .setCookie(REFRESH_COOKIE, refreshRaw, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/auth',
        maxAge: env.JWT_REFRESH_TTL_SEC,
      })
      .code(200)
      .send({
        ok: true,
        data: {
          access_token: accessToken,
          expires_in: expiresIn,
          user: {
            id: user.id,
            email: user.email,
            two_fa_enabled: !!user.totpSecret,
            has_payment_method: !!user.stripeCustomerId,
            created_at: user.createdAt.toISOString(),
          },
        },
      });
  });
}
