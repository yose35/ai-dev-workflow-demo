// Spec: AC-R1 .. AC-R4
// 對應 OpenAPI: POST /auth/register
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@pkg/db';
import { errors } from '../../lib/errors.js';
import { hashPassword, validatePassword } from '../../lib/password.js';
import { signAccessToken } from '../../lib/jwt.js';
import type { Env } from '../../config/env.js';

const Body = z.object({
  email: z.string().email().max(254),
  password: z.string(),
});

export function registerRoute(app: FastifyInstance, env: Env) {
  app.post('/auth/register', async (req, reply) => {
    // ── 輸入驗證 (AC-R3, AC-R4) ────────────────────────────────
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      // email 格式錯
      if (issue?.path[0] === 'email') {
        throw errors.invalidEmail();
      }
      throw errors.weakPassword('Body 格式錯誤');
    }
    const { email, password } = parsed.data;

    const pwCheck = validatePassword(password);
    if (!pwCheck.ok) {
      throw errors.weakPassword(pwCheck.reason);
    }

    // ── 重複 email 檢查 (AC-R2) ────────────────────────────────
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw errors.userExists();
    }

    // ── 建立使用者 (AC-R1) ────────────────────────────────────
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), passwordHash },
      select: { id: true, email: true, createdAt: true },
    });

    const { token: accessToken, expiresIn } = await signAccessToken(
      { sub: user.id, email: user.email },
      env.JWT_SECRET,
      env.JWT_ACCESS_TTL_SEC
    );

    return reply.code(201).send({
      ok: true,
      data: {
        access_token: accessToken,
        expires_in: expiresIn,
        user: {
          id: user.id,
          email: user.email,
          two_fa_enabled: false,
          has_payment_method: false,
          created_at: user.createdAt.toISOString(),
        },
      },
    });
  });

  // error handler 已抽到 plugins/errorHandler.ts，由 server.ts 統一註冊
}
