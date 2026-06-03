// 改為獨立 plugin — 取代原本散在 route 內的 setErrorHandler
// 對應 PR #1 Review comment：error handler 位置
import type { FastifyInstance } from 'fastify';
import { AppError } from '../lib/errors.js';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send(err.toJSON());
    }
    // Fastify rate-limit 拋的 error 有 statusCode 屬性
    if ('statusCode' in err && err.statusCode === 429) {
      return reply.code(429).send({
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({
      ok: false,
      error: { code: 'INTERNAL', message: 'Server error' },
    });
  });
}
