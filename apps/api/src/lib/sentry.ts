// Sentry init — 在 server.ts 最早期呼叫
// 沒設 SENTRY_DSN 就 no-op，本機開發完全不影響
import * as Sentry from "@sentry/node";

export function initSentry(env: {
  SENTRY_DSN?: string;
  NODE_ENV: string;
}): void {
  if (!env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // 採樣率：production 10%、staging 100%，避免雜訊
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
    // PII 預設不送
    sendDefaultPii: false,
    // 過濾 hook — 把 PII 從 event 中拿掉
    beforeSend(event) {
      // request body 內可能含密碼 / token，整段拔掉
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      return event;
    },
  });
}

export { Sentry };
