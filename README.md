# AI Dev Workflow Demo

> **會員登入 + 付款方式綁定** — 一個完整可運作的全棧 demo，**同時也是 AI 開發流程的活體展示**。
> 完整對照數字記在 [Notion AI Dev Workflow / Run Log](https://www.notion.so/372309d695ca81ada173ed62d12f5b5d)。

---

## 🎯 兩個身份

這個 repo 有兩個讀法：

1. **產品身份**：一個生產級別的會員登入 + Stripe 卡片綁定模組，可直接 fork 改造
2. **流程身份**：示範「AI Dev Workflow Kit」如何把 5 工作天的全棧開發壓縮成 25 分鐘

---

## 📊 實測對照（11 筆 Notion Run Log 全部可稽核）

| 維度 | 人工估時 | AI 實測 | 加速 |
|---|---:|---:|---:|
| 規格 + OpenAPI 契約 | 6–8 小時 | 2.3 分 | ~180× |
| BE 全部（PR #1–6） | 19.5 小時 | 14.3 分 | ~82× |
| FE 全部（PR #1–4） | 11 小時 | 7.6 分 | ~85× |
| **全棧合計** | **36.5–38.5 小時** | **24.2 分** | **~93×** |

詳細 demo 包裝（簡報 / 一頁紙 / 影片腳本 / Q&A）放在 `demo-package/`（如有）或私下提供。

---

## 🚀 快速啟動

```bash
# 1. 安裝 pnpm（若沒裝）
corepack enable
corepack prepare pnpm@9.0.0 --activate

# 2. 安裝相依套件
pnpm install

# 3. 複製環境變數範本
cp .env.example .env

# 4. 跑全部測試
pnpm test
# 預期: 74 個全綠（BE 55 + FE unit 15 + integration 4）

# 5. 開啟前端（BE 不在也能跑，靠 msw mock）
pnpm dev:web
# → http://localhost:3001

# 6. 開啟後端（可選）
pnpm dev
# → http://localhost:3000
```

---

## 🧪 跑 E2E

```bash
cd apps/web
npx playwright install chromium     # 一次性下載 ~150MB
pnpm test:e2e                       # headless
pnpm test:e2e:headed                # 看著瀏覽器跑
```

---

## 🏗️ 技術棧

### Backend (`apps/api/`)
- **Fastify** + TypeScript strict
- **Prisma** + PostgreSQL
- **@node-rs/argon2** 密碼 hash（Rust 預編譯，免 build）
- **jose** JWT short-lived + refresh token rotation
- **otplib** TOTP 2FA + constant-time 比較
- **google-auth-library** Google OAuth id_token 驗證
- **Stripe SDK** + webhook signature 驗證
- **Vitest** 單元 + 整合測試

### Frontend (`apps/web/`)
- **Next.js 15** App Router + React 19 + TypeScript strict
- **Tailwind CSS 4**
- **react-hook-form + zod** 表單與驗證（與 BE 共用 schema）
- **MSW (Mock Service Worker)** 攔截 fetch，BE 不在也能跑
- **openapi-typescript** 由 OpenAPI 契約自動產 TS types
- **Vitest + Testing Library** unit / component test
- **Playwright** E2E（自動錄影 demo 影片素材）

### Contract (`packages/contract/`)
- **OpenAPI 3.1** 12 個端點，BE / FE 共用契約

---

## 📁 目錄結構

```
.
├── apps/
│   ├── api/          # Backend (Fastify)
│   └── web/          # Frontend (Next.js)
├── packages/
│   ├── contract/     # OpenAPI 契約
│   └── db/           # Prisma schema + migrations
├── docs/
│   ├── adr/          # 架構決策紀錄（5 份）
│   └── templates/    # Spec / ADR 範本
├── specs/            # 產品規格（PRD）
├── .github/
│   ├── workflows/    # AI Review + Test workflows
│   └── PULL_REQUEST_TEMPLATE.md
├── CLAUDE.md         # AI 接手脈絡 ← 任何 AI 先讀這個
├── PLAN.md           # 活動工作紀錄
└── README.md         # 你正在看的
```

---

## 🤖 AI 接手須知

任何 AI Agent（Claude Code / Cursor / Copilot）開始工作前，按順序讀：

1. **[`CLAUDE.md`](./CLAUDE.md)** — 專案脈絡、技術棧、開發鐵則（必讀）
2. **[`PLAN.md`](./PLAN.md)** — 目前進度與下一步
3. 相關 **[`specs/<feature>.md`](./specs/)** — 確認需求
4. 相關 **[`docs/adr/`](./docs/adr/)** — 過去決策

完整協作守則見 `CLAUDE.md` 第 10 節。

---

## 🎬 AI Code Review

每個 PR 自動跑 `.github/workflows/ai-review.yml`：
1. PR 開啟或 push commit → AI Review 約 25 秒內留 markdown 形式 review
2. AI 對照 `CLAUDE.md` 規則 + PR diff 檢查資安 / 邊界 / 命名 / 慣例
3. 緊急 PR 加 `skip-ai-review` label 可跳過

要關掉這個流程：刪 `.github/workflows/ai-review.yml` 即可。

---

## 📚 已寫好的 ADR（架構決策紀錄）

| ADR | 主題 |
|---|---|
| ADR-001 | 認證與付款資料模型（單表 vs identities 表的取捨） |
| ADR-002 | Refresh Token Rotation + 偷竊偵測 |
| ADR-003 | Google OAuth + HMAC-state CSRF |
| ADR-004 | 2FA TOTP + stateless challenge |
| ADR-005 | Stripe 整合 + PCI 合規 |

完整在 [`docs/adr/`](./docs/adr/)。

---

## 🔧 常用指令

```bash
pnpm install                     # 全套件安裝
pnpm dev                         # 啟動 BE
pnpm dev:web                     # 啟動 FE
pnpm test                        # 全部測試
pnpm test --filter @app/api      # 只跑 BE
pnpm test --filter @app/web      # 只跑 FE
pnpm contract:gen                # 由 OpenAPI 重新產 TS types
pnpm db:migrate                  # DB migration
```

---

## 🌐 環境變數

複製 `.env.example` 到 `.env` 後填：

| 變數 | 用途 | 必填 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 連線字串 | BE 必填 |
| `JWT_SECRET` | JWT 簽章金鑰（32+ chars） | BE 必填 |
| `STRIPE_SECRET_KEY` | Stripe 測試金鑰 | 付款功能用 |
| `STRIPE_WEBHOOK_SECRET` | Webhook 簽章 | 付款功能用 |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth | Google 登入用 |
| `ANTHROPIC_API_KEY` | （GitHub Secret）AI Review 用 | CI 必填 |
| `NEXT_PUBLIC_API_BASE` | FE → BE base URL | FE，留空即啟用 msw mock |

---

## 📦 部署

目前 demo 階段未提供部署設定。生產導入時需補：
- BE: Fly.io / Railway / AWS ECS（Docker）
- FE: Vercel / Cloudflare Pages
- DB: Neon / Supabase / RDS
- 監控: Sentry + Logflare

---

## 🤝 貢獻

1. 開 branch `feat/<scope>`
2. 開工前更新 `PLAN.md` 的「下一步」
3. 每段落 commit，commit 訊息格式 `<type>(<scope>): <subject>`
4. 開 PR，等 AI Review + 人類 review
5. CI 全綠 + 1 approval → merge

完整見 [`.github/PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md)。

---

## 📜 License

Private / Internal demo. 對外請先確認。
