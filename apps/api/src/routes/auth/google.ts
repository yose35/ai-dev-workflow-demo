// Spec: AC-L3 / 第 8 節 OAuth state CSRF
// OpenAPI: POST /auth/google (主流程) + GET /auth/google/state (CSRF 配發)
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@pkg/db';
import { AppError, errors } from '../../lib/errors.js';
import { issueState, verifyState } from '../../lib/csrfState.js';
import { verifyGoogleIdToken } from '../../lib/googleOAuth.js';
import { signAccessToken } from '../../lib/jwt.js';
import { issueRefreshToken } from '../../lib/refreshToken.js';
import type { Env } from '../../config/env.js';

const Body = z.object({
  id_token: z.string().min(10),
  state: z.string().min(10),
});

const REFRESH_COOKIE = 'refresh_token';
const PROVIDER = 'google';

export function googleRoute(app: FastifyInstance, env: Env) {
  // CSRF state 配發 — FE 在重導到 Google 前呼叫一次
  app.get('/auth/google/state', async (_req, reply) => {
    return reply.send({
      ok: true,
      data: { state: issueState(env.JWT_SECRET) },
    });
  });

  app.post('/auth/google', async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('OAUTH_STATE_INVALID', 401, 'Bad payload');
    }
    const { id_token, state } = parsed.data;

    // ── CSRF state 驗證 ──────────────────────────────────────
    if (!verifyState(state, env.JWT_SECRET)) {
      throw new AppError('OAUTH_STATE_INVALID', 401, 'Invalid OAuth state');
    }

    if (!env.GOOGLE_OAUTH_CLIENT_ID) {
      req.log.error('GOOGLE_OAUTH_CLIENT_ID not configured');
      throw new AppError('OAUTH_STATE_INVALID', 401, 'Server OAuth misconfigured');
    }

    // ── id_token 驗證 ────────────────────────────────────────
    let profile;
    try {
      profile = await verifyGoogleIdToken(id_token, env.GOOGLE_OAUTH_CLIENT_ID);
    } catch (e) {
      req.log.warn({ err: e }, 'Google id_token verify failed');
      throw new AppError('OAUTH_STATE_INVALID', 401, 'Invalid Google id_token');
    }

    // ── 找或建 user：先看 oauth sub，再嘗試 link 既有 email ──
    let user = await prisma.user.findFirst({
      where: { oauthProvider: PROVIDER, oauthSub: profile.sub },
    });

    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
      if (byEmail) {
        // Link 既有 email 帳號到 Google
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: { oauthProvider: PROVIDER, oauthSub: profile.sub },
        });
      } else {
        // 新使用者
        user = await prisma.user.create({
          data: {
            email: profile.email.toLowerCase(),
            oauthProvider: PROVIDER,
            oauthSub: profile.sub,
            // passwordHash 留空：之後可在設定頁補設密碼
          },
        });
      }
    }

    // 2FA 啟用者也走相同流程？依 spec 暫定 OAuth 路徑暫不強制 2FA（產品決策）
    void errors; // reserved for future use

    // ── 簽 tokens ────────────────────────────────────────────
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
