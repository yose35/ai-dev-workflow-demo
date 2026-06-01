# PLAN.md — 進行中工作（活文件）

> 任何人或 AI 開工前更新「下一步」，做完劃掉。每段落 commit 一起 push。
> 與 Notion `Sprint Plans` 雙寫同步。

---

## 當前 Sprint 目標

**Sprint 23（2026-06-01 → 2026-06-14）**
完成「登入 + 付款方式綁定」BE 端到端，並由 FE 平行使用 OpenAPI mock 啟動開發。
驗收：登入 + 註冊 + 卡片綁定 API 可在 staging 跑通，coverage > 85%，AI Review 全綠。

Notion：[Sprint Plans → Sprint 23](https://www.notion.so/3d46c83c3cc242b2812a9375b48e6435)

---

## 進行中的 Ticket

### `LIN-AUTH-PAY-001` — 會員登入 + 付款方式綁定

- **負責人**：BE Lead（與 AI Agent 共同）
- **Spec**：[`specs/login-and-payment.md`](./specs/login-and-payment.md) ／ [Notion Specs](https://www.notion.so/372309d695ca81868a3dce2791643f1d)
- **API Contract**：[`packages/contract/openapi.yaml`](./packages/contract/openapi.yaml)（已完成 v0.1）
- **狀態**：In progress — BE Plan 已完成，等待 BE Code 啟動

#### 已完成（BE Plan 階段）

- [x] 讀 spec、確認 17 個 acceptance criteria
- [x] 產出 OpenAPI 3.1 契約（12 端點、6 schema）
- [x] 同步 spec 進 Notion Specs DB（雙寫驗證 ✅）
- [x] 確認對外整合：Stripe 測試環境、Google OAuth、Twilio 暫不做（2FA 改 TOTP-only）

#### 進行中

> 沒有，等 BE Code 階段開工

#### 下一步（BE Code 階段，依序）

> 工程師 / AI 接手後依此順序推進，每完成一段就 commit。

1. **建立 monorepo 骨架** `apps/api/` + `packages/contract/` + `packages/db/`
   - 採 pnpm workspace
   - TypeScript strict mode
   - 預期：30 分鐘
2. **DB schema + 第一支 migration**（`20260601_init_auth_payment.sql`）
   - 三張表：`users`、`refresh_tokens`、`payment_methods`
   - 對應 ADR 寫一份 `docs/adr/2026-06-01-auth-schema.md`
   - 預期：1 小時
3. **POST /auth/register** handler + validator + unit test
   - 涵蓋 AC-R1..R4
   - 預期：2 小時
4. **POST /auth/login** + `/auth/refresh` + `/auth/logout`
   - 涵蓋 AC-L1..L4
   - refresh token reuse detection（被偷會撤銷整組 session）
   - 預期：3 小時
5. **Google OAuth `/auth/google`**
   - state CSRF 檢查、自動建立 / 連結既有帳號
   - 預期：2 小時
6. **2FA enroll / verify**
   - TOTP 用 `otplib`，constant-time 比較
   - 涵蓋 AC-2FA-1..2
   - 預期：2 小時
7. **Stripe SetupIntent + webhook + payment methods CRUD**
   - 涵蓋 AC-PAY-1..5
   - webhook idempotency by `event.id`
   - 預期：4 小時
8. **整合測試**：跑完一個完整流程（register → login → 2FA → 綁卡 → 列表 → 解綁）
   - 預期：1 小時

**PR 切點建議：**
- PR #1：步驟 1–2（骨架 + DB）
- PR #2：步驟 3–4（auth 主流程）
- PR #3：步驟 5（OAuth）
- PR #4：步驟 6（2FA）
- PR #5：步驟 7–8（Payments + 整合測試）

#### 已知未決

- ❓ refresh token 放 httpOnly cookie 還是回給 client 自存？**傾向 cookie**，但需 FE 確認他們能 read-only access
- ❓ 2FA backup codes 是否本 sprint 範圍？**暫不**做，下個 ticket
- ❓ Stripe Customer 與 User 的對應：一對一還是一對多？**一對一**，反正 demo 用

#### 阻塞

- 🔴 等 PM 確認「登入 + 付款」是否要含「忘記密碼」 → **已澄清：不在本 sprint 範圍**
- 🔴 等 DevOps 提供測試 Postgres connection string

---

## FE 平行啟動

> **重要：FE 不需等 BE。** OpenAPI 已備齊，可立即 mock 開發。

FE 啟動清單：
1. 跑 `pnpm contract:gen` 由 `openapi.yaml` 產 TypeScript types
2. 用 `msw` 或 `prism` 跑 mock server，依 OpenAPI 自動產假回應
3. 並行開發頁面：註冊、登入、Google 回呼、2FA 啟用、卡片管理

預期 FE 約 6 工時可完成所有頁面 mock 串接，等 BE merge 後切到真 endpoint 即可。

---

## 已完成的 Ticket（本 sprint）

- *（待 BE Code 階段完成後填入）*

---

## 決策紀錄索引

- `docs/adr/2026-06-01-auth-schema.md` — User / token / payment method schema *(BE Code 階段產出)*
- `docs/adr/2026-06-01-password-hash.md` — argon2id over bcrypt *(草稿)*
- `docs/adr/2026-06-01-refresh-token-strategy.md` — httpOnly cookie + reuse detection *(草稿)*

Notion 同步：[ADRs DB](https://www.notion.so/a530d85879a14aa4a6b3c32bca5127ac)

---

## AI 接手清單（給接手 AI 看）

當 AI 從這份檔案接手 BE Code 階段：

1. ✅ 讀本檔的「當前 Sprint 目標」
2. ✅ 從「下一步」第 1 項開始，**不要跳號**
3. ✅ 動工前更新「進行中」段並標註自己（例：「by claude-bot」）
4. ✅ 完成每一小步立即 commit + 把該項從「下一步」搬到「已完成」
5. ✅ 任何架構選擇 → 寫一份 ADR 進 `docs/adr/`，並同步到 Notion ADRs DB
6. ✅ 開 PR 時帶 `Closes LIN-AUTH-PAY-001`（部分 PR 可改 `Part of`）
7. ✅ PR description 使用 `.github/PULL_REQUEST_TEMPLATE.md`

**遇到取捨？** 寫在 PR description 的「給 reviewer 的提示」段，標 `@PM @TL` 並繼續推進，不要卡住。
