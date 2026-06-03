# CLAUDE.md — 專案脈絡檔

> 這份檔案是 AI 接手此專案的入口。任何 AI Agent（Claude Code / Cursor / Copilot）開始工作前都先讀這份。
> **規則：每次重大決策或架構變動後，必須更新此檔。** 過時的 CLAUDE.md 比沒有 CLAUDE.md 更糟。

---

## 1. 專案速覽

- **專案名稱**：<填入>
- **業務目的（一句話）**：<例：讓會員能用 Email 或 Google 登入，並綁定信用卡進行月費訂閱>
- **目前階段**：<MVP / 內測 / 正式上線 / 維運>
- **核心使用者**：<填入>
- **成功指標**：<例：DAU、付費轉換率、登入成功率>

## 2. 技術棧

| 層 | 選型 | 理由 |
|---|---|---|
| Backend | <例：Node.js + Fastify + TypeScript> | <填> |
| Database | <例：PostgreSQL 16 + Prisma> | <填> |
| Frontend | <例：Next.js 14 App Router + React 18> | <填> |
| 認證 | <例：自架 JWT + Google OAuth + Twilio 2FA> | <填> |
| 金流 | <例：Stripe> | <填> |
| 監控 | <例：Sentry + Logflare> | <填> |
| CI/CD | GitHub Actions | <填> |

## 3. 目錄結構

```
.
├── apps/
│   ├── api/          # Backend
│   └── web/          # Frontend
├── packages/
│   ├── contract/     # OpenAPI / shared types — BE 與 FE 的契約
│   └── ui/           # 共用 UI 元件
├── docs/             # 設計文件、ADR
├── specs/            # 產品規格（PRD）
└── PLAN.md           # 目前進行中的工作計畫（活文件）
```

## 4. 開發鐵則（給 AI 與工程師）

1. **API Contract 先行**：任何新功能先在 `packages/contract/` 補上 OpenAPI，BE 與 FE 才開工。
2. **雙寫紀錄**：重要決策同時寫進 `docs/adr/` 與 Notion。AI 兩邊都會讀。
3. **PLAN.md 是活文件**：每個 ticket 開工時更新「下一步」段落，做完劃掉。
4. **不要破壞測試**：任何 PR 必須通過所有 CI 才能 merge，例外需在 PR description 標註「臨時跳過」。
5. **資安預設安全**：密碼用 argon2id、JWT 短效期 + refresh、SQL injection 用 ORM 全包、付款資料絕不落地。
6. **可逆 migration**：所有 DB migration 必須附 down 腳本。
7. **commit 訊息格式**：`<type>(<scope>): <subject>`，type ∈ {feat, fix, refactor, test, docs, chore}。

## 5. 重要慣例（給 AI 參考）

- **錯誤處理**：API 一律回 `{ ok: false, error: { code, message } }`，code 用 SCREAMING_SNAKE。
- **時間**：所有時間用 UTC ISO 8601 字串，前端再轉本地時區。
- **命名**：camelCase（變數）、PascalCase（型別 / 元件）、kebab-case（檔名 / URL）、SCREAMING_SNAKE（環境變數 / 常數）。
- **測試命名**：`<檔名>.test.ts` 與被測試檔同層。

## 6. 目前已知的「不要動」

- <例：`apps/api/src/legacy/` 是舊系統 shim，動了會壞掉，先別動>
- <例：`PaymentService.charge()` 的 mutex 鎖必須保留，移除會 double charge>

## 7. 常用指令

```bash
# 全套件安裝
pnpm install

# 啟動所有服務
pnpm dev

# 測試
pnpm test                # 全部
pnpm test --filter=api   # 只跑 BE

# 由 OpenAPI 重新產 type
pnpm contract:gen

# DB migrate
pnpm db:migrate
```

## 8. 環境與 secrets

- `.env.example` 是唯一可信來源。新增變數必須同步更新。
- Production secrets 走 <例：Doppler / AWS Secrets Manager>。
- 本地測試 Stripe 用測試 key，不要碰 live key。

## 9. 對外整合

| 服務 | 用途 | 文件 |
|---|---|---|
| Stripe | 訂閱付款 | <連結> |
| Google OAuth | 第三方登入 | <連結> |
| Twilio | 2FA SMS | <連結> |
| Sentry | 錯誤監控 | <連結> |

## 10. AI 工作守則（重點！）

當你（AI）開始任何工作前：

1. **先讀 `PLAN.md`** 看目前進度與下一步
2. **看相關 `docs/adr/`** 了解過去決策
3. **檢查相關 `specs/<feature>.md`** 確認需求
4. **計畫先行**：先在 `PLAN.md` 寫出你打算做的事，再動手
5. **小步快跑**：每個小段落結束就更新 `PLAN.md`，方便人類追蹤與接手
6. **遇到設計取捨**：寫入 `docs/adr/<日期>-<決策名>.md`
7. **PR description**：套用 `.github/PULL_REQUEST_TEMPLATE.md`
