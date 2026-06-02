// Pino 結構化 logger
// production 預設 JSON、dev 預設 pretty
// 內建 redaction：絕不洩漏密碼 hash、token、JWT、Stripe secret 到 log
//
// 兩種 export：
//   loggerOptions  ← 給 Fastify constructor 用（避免型別污染 FastifyInstance）
//   logger         ← 給外部呼叫用（process.on('uncaughtException') 等）
import { pino, type LoggerOptions } from "pino";

const isProd = process.env.NODE_ENV === "production";

const redactPaths = [
  "password",
  "password_hash",
  "passwordHash",
  "token",
  "token_hash",
  "tokenHash",
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "id_token",
  "totp_secret",
  "totpSecret",
  "client_secret",
  "stripe_payment_method_id",
  "stripePaymentMethodId",
  "*.password",
  "*.password_hash",
  "*.token_hash",
  "*.refresh_token",
  "*.access_token",
  "*.totp_secret",
  "*.client_secret",
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["stripe-signature"]',
];

export const loggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
  redact: { paths: redactPaths, censor: "[REDACTED]" },
  ...(isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }),
};

export const logger = pino(loggerOptions);
