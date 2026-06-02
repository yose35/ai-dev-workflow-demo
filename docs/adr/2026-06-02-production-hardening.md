# ADR-006: 生產導入硬化（第 1 波 — 程式碼面）

- 日期：2026-06-02
- 狀態：Accepted
- 決策者：AI Agent + 待 BE/FE Lead 確認

## Context

Demo 階段已完成全棧功能；要邁向真實生產導入，先補強**程式碼面**的硬化（不需外部帳號就能做）：
- 觀測性（structured logging / error tracking）
- 安全 hardening（headers / CORS / 機密遮罩）
- 部署封裝（Docker）
- 開發品質防線（pre-commit）
- 使用者體驗（重新整理不掉登入）

## Decisions

### 1. Logging：Pino + 強制 redaction
- 用 `pino`，production JSON、dev pretty。
- **redact paths 強制遮罩**：所有 password / token / hash / Stripe secret / Authorization header / cookie。
- 取代原本 Fastify 預設 logger（不會自動遮罩敏感資料）。

### 2. Error tracking：Sentry（程式碼面準備好，DSN 留空即 no-op）
- BE：`@sentry/node` + `initSentry()` 在 server 啟動最早期呼叫。
- FE：`@sentry/nextjs` + `instrumentation.ts`（Next.js 標準入口）。
- `beforeSend` 過濾掉 PII：request body / cookie / authorization header 一律拔掉。

### 3. Security headers
- BE：`@fastify/helmet`（CSP 留給 FE 控制）+ `@fastify/cors`（whitelist `CORS_ORIGIN`）。
- FE：Next.js `headers()` 設定 HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy。

### 4. Docker：multi-stage
- `apps/api/Dockerfile` — Alpine + tini + non-root + Prisma 預先 generate。
- `apps/web/Dockerfile` — Next.js standalone output（最小化 image）。
- `docker-compose.yml` 一鍵起 Postgres + BE + FE。

### 5. Refresh token 串接 FE — 重新整理不掉登入
- access token 存記憶體 + `tokenStore`（避免 localStorage XSS 風險）。
- `AuthProvider` mount 時自動 `POST /auth/refresh` + `GET /me`。
- `apiFetch` 遇 401 自動觸發 single-flight refresh 並重試一次。

### 6. Pre-commit hook：husky + lint-staged
- 提交前針對改動到的 workspace 跑 typecheck（`tsc --noEmit`）。
- `--no-verify` 可跳過（緊急時）。

## Out of scope（之後 ADR 處理）

- 真實部署平台選型（Fly.io / Vercel / Neon）— 屬於部署手冊範圍
- i18n、Feature flag、Audit log — 規模化才需要
- WebAuthn / passkey — UX 升級項目

## Consequences

- 正面：
  - Production observability 就緒，DSN 填上即可啟用
  - 敏感資料**不再可能洩漏進 log**
  - 任何環境都能 `docker compose up` 一鍵跑起來
  - FE 刷新不掉登入（UX 重大改善）
  - pre-commit 攔住明顯型別錯誤
- 負面：
  - 多了 3–5 個 deps（pino / @sentry/* / helmet / cors）
  - Docker 多階段 build 第一次較慢（~3 分鐘）
- 待辦：
  - 真實部署時把 Sentry DSN / 真實 OAuth client / Stripe live key 填入 production secret manager

## References

- 程式碼：
  - `apps/api/src/lib/logger.ts`
  - `apps/api/src/lib/sentry.ts`
  - `apps/api/Dockerfile`
  - `apps/web/Dockerfile`
  - `apps/web/src/instrumentation.ts`
  - `apps/web/src/lib/api-client.ts`（401 retry）
  - `apps/web/src/lib/auth-store.tsx`（boot refresh）
- 設定：
  - `docker-compose.yml`
  - `apps/web/next.config.mjs`（security headers）
  - `package.json`（husky + lint-staged）
