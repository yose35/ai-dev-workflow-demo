// Spec: AC-2FA-1, AC-2FA-2
// OpenAPI: POST /auth/2fa/enroll (auth) + POST /auth/2fa/verify
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@pkg/db';
import { AppError, errors } from '../../lib/errors.js';
import { requireAuth } from '../../lib/auth.js';
import {
  generateTotpSecret,
  buildOtpAuthUrl,
  generateQrDataUrl,
  verifyTotp,
} from '../../lib/totp.js';
import { verifyChallenge } from '../../lib/twoFaChallenge.js';
import { signAccessToken } from '../../lib/jwt.js';
import { issueRefreshToken } from '../../lib/refreshToken.js';
import type { Env } from '../../config/env.js';

const REFRESH_COOKIE = 'refresh_token';

const VerifyBody = z.object({
  code: z.string().regex(/^[0-9]{6}$/),
  challenge_id: z.string().optional(),
});

export function twoFaRoutes(app: FastifyInstance, env: Env) {
  // AC-2FA-1: 啟用 2FA — 需 authenticated
  app.post('/auth/2fa/enroll', async (req, reply) => {
    const { userId, userEmail } = await requireAuth(req, env.JWT_SECRET);

    const secret = generateTotpSecret();
    const otpauth = buildOtpAuthUrl(userEmail, secret);
    const qrDataUrl = await generateQrDataUrl(otpauth);

    // 注意：寫入後使用者「立刻」啟用 2FA，下次登入會被要求驗證
    // 簡化設計，沒有 pending state。若 user 失去 authenticator，可再 enroll 一次覆寫
    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret },
    });

    return reply.send({
      ok: true,
      data: { secret, qr_data: qrDataUrl },
    });
  });

  // AC-2FA-2: 驗證 TOTP code
  // 兩種情境：
  //   (a) 帶 challenge_id：login 流程的第二階段，驗 challenge → 簽 tokens
  //   (b) 不帶 challenge_id：需 authenticated，當作 confirm enrollment（idempotent）
  app.post('/auth/2fa/verify', async (req, reply) => {
    const parsed = VerifyBody.safeParse(req.body);
    if (!parsed.success) {
      throw errors.invalid2faCode();
    }
    const { code, challenge_id } = parsed.data;

    if (challenge_id) {
      // ── (a) login 完成流程 ───────────────────────────────
      const c = verifyChallenge(challenge_id, env.JWT_SECRET);
      if (!c.ok) {
        throw errors.invalid2faCode();
      }
      const user = await prisma.user.findUnique({ where: { id: c.userId } });
      if (!user || !user.totpSecret) {
        throw errors.invalid2faCode();
      }
      if (!verifyTotp(code, user.totpSecret)) {
        throw errors.invalid2faCode();
      }

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
              two_fa_enabled: true,
              has_payment_method: !!user.stripeCustomerId,
              created_at: user.createdAt.toISOString(),
            },
          },
        });
    }

    // ── (b) confirm enrollment（已登入）──────────────────
    const { userId } = await requireAuth(req, env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) {
      throw new AppError('INVALID_2FA_CODE', 401, '2FA not enrolled');
    }
    if (!verifyTotp(code, user.totpSecret)) {
      throw errors.invalid2faCode();
    }
    return reply.send({ ok: true, data: { two_fa_enabled: true } });
  });
}
