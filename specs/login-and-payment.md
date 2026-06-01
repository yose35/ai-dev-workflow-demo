# Spec — 會員登入 + 付款方式綁定

- **作者**：（demo 用）AI 草稿，待 PM Review
- **狀態**：Draft
- **版本**：v0.1 — 2026-06-01
- **Linear Epic**：LIN-AUTH-PAY-001
- **Figma**：<待補>

---

## 1. 為何要做（Why）

為了驗證 **AI Dev Workflow Kit** 的端到端可行性，並產出可放進產品的會員登入與付款綁定模組。
此功能是大多數 SaaS 的最低共同分母 — 完成後可衡量「人工 vs AI」的真實成本差距，為後續預算申請提供依據。

## 2. 不做什麼（Out of scope）

- 忘記密碼 / 重設密碼（下一個 sprint）
- 多帳號合併（不在此範圍）
- Apple / Facebook OAuth（暫只做 Google）
- 訂閱方案管理（只做卡片綁定 + 一次性 setup intent）
- 後台管理介面（會員列表只做 read，不做編輯）

## 3. 使用者故事

```
US-1: 作為新使用者，我想用 Email + 密碼註冊，以便快速建立帳號。
US-2: 作為新使用者，我想用 Google 一鍵登入，以便省去填表單。
US-3: 作為已註冊使用者，我想開啟 2FA，以便提高帳號安全。
US-4: 作為登入使用者，我想綁定信用卡，以便日後支付月費。
US-5: 作為登入使用者，我想看到並移除已綁定卡片，以便管理付款方式。
```

## 4. Acceptance Criteria

> AI 會直接由此產測試案例

### Register（US-1）

- **AC-R1**：Given 未註冊 email + 強密碼，When `POST /auth/register`，Then 回 201 + JWT，DB 內建立 user。
- **AC-R2**：Given email 已存在，When `POST /auth/register`，Then 回 409 `USER_EXISTS`。
- **AC-R3**：Given 密碼少於 10 字 或 不含數字與字母，When `POST /auth/register`，Then 回 400 `WEAK_PASSWORD`。
- **AC-R4**：Given email 格式不正確，When `POST /auth/register`，Then 回 400 `INVALID_EMAIL`。

### Login（US-1, US-2）

- **AC-L1**：Given 正確 email + 密碼，When `POST /auth/login`，Then 回 200 + access token（15 分鐘）+ refresh token（30 天，httpOnly cookie）。
- **AC-L2**：Given 錯誤密碼，When `POST /auth/login`，Then 回 401 `INVALID_CREDENTIALS`。同一 IP 連續 5 次失敗 → 鎖 15 分鐘回 429 `RATE_LIMITED`。
- **AC-L3**：Given Google OAuth callback 帶有效 id_token，When `POST /auth/google`，Then 若是新使用者自動建立帳號，回 200 + tokens。
- **AC-L4**：Given access token 過期、refresh token 有效，When `POST /auth/refresh`，Then 回 200 + 新 access token。

### 2FA（US-3）

- **AC-2FA-1**：Given 已登入使用者，When `POST /auth/2fa/enroll`，Then 回 200 + TOTP secret + QR code data URL。
- **AC-2FA-2**：使用者啟用 2FA 後，下次 login 需多帶 `code`，少帶或錯誤回 401 `2FA_REQUIRED` / `INVALID_2FA_CODE`。

### 卡片綁定（US-4, US-5）

- **AC-PAY-1**：Given 已登入使用者，When `POST /payments/setup-intent`，Then 回 200 + Stripe SetupIntent client_secret。
- **AC-PAY-2**：Stripe 端確認成功後 webhook 觸發 → 系統儲存 Stripe `payment_method.id`，**絕不存卡號**。
- **AC-PAY-3**：`GET /payments/methods` 回該使用者所有綁定卡片的 last4 + brand + 到期月份。
- **AC-PAY-4**：`DELETE /payments/methods/:id` 解除綁定並 detach Stripe 端。
- **AC-PAY-5**：若使用者僅一張卡，刪除前需 confirm dialog（FE）。

## 5. UI / UX

- Figma：<待補>
- 主要頁面：註冊頁、登入頁、Google 重導頁、2FA 設定頁、付款方式管理頁
- 錯誤態：表單錯誤 inline 顯示、429 顯示倒數計時、Stripe Element 失敗顯示原因
- 空狀態：未綁卡顯示「新增第一張卡片」CTA

## 6. 資料模型

```sql
-- users
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT,                       -- nullable: OAuth 使用者可為 null
  totp_secret     TEXT,                       -- nullable: 未啟用 2FA 為 null
  stripe_customer_id TEXT UNIQUE,             -- nullable: 未綁卡前為 null
  oauth_provider  TEXT,                       -- 'google' or null
  oauth_sub       TEXT,                       -- Google sub
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_sub);

-- refresh_tokens
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

-- payment_methods
CREATE TABLE payment_methods (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT NOT NULL UNIQUE,
  brand                    TEXT,
  last4                    TEXT,
  exp_month                INT,
  exp_year                 INT,
  is_default               BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_user ON payment_methods(user_id);
```

## 7. API 端點

| Method | Path | Auth | 用途 |
|---|---|---|---|
| POST | `/auth/register` | none | Email 註冊 |
| POST | `/auth/login` | none | Email 登入 |
| POST | `/auth/google` | none | Google OAuth 登入 |
| POST | `/auth/refresh` | refresh cookie | 換新 access token |
| POST | `/auth/logout` | access | 撤銷 refresh |
| POST | `/auth/2fa/enroll` | access | 啟用 2FA |
| POST | `/auth/2fa/verify` | access | 驗證 TOTP |
| GET  | `/me` | access | 取得本人資訊 |
| POST | `/payments/setup-intent` | access | 開啟卡片綁定 |
| POST | `/payments/webhooks/stripe` | Stripe sig | 接 Stripe webhook |
| GET  | `/payments/methods` | access | 列出卡片 |
| DELETE | `/payments/methods/:id` | access | 解除綁定 |

正式 OpenAPI 將於 BE Plan 階段放 `packages/contract/openapi.yaml`。

## 8. 邊界與異常

- **重複註冊**：409 USER_EXISTS
- **弱密碼**：400 WEAK_PASSWORD（含詳細規則訊息）
- **暴力登入**：同 IP / 同 email 5 次失敗 → 鎖 15 分鐘，429 RATE_LIMITED
- **Google OAuth state mismatch**：401 OAUTH_STATE_INVALID（防 CSRF）
- **2FA 時序攻擊**：所有 TOTP 比對使用 constant-time 比較
- **Stripe webhook 重複**：以 `event.id` 作 idempotency key
- **Refresh token reuse 偵測**：若用過的 refresh 再次出現 → 撤銷該使用者所有 session
- **刪除最後一張卡**：BE 允許，但 FE 提示確認

## 9. 量測（埋點）

- `auth.register.completed` { method: email | google }
- `auth.register.failed` { reason }
- `auth.login.completed` { method }
- `auth.login.failed` { reason }
- `auth.2fa.enrolled`
- `payment.method.added` { brand }
- `payment.method.removed`
- 監控指標：
  - 註冊成功率（成功 / 嘗試）
  - 登入成功率
  - 平均回應時間 p95 < 200ms
  - Stripe webhook 處理失敗率 < 0.1%

## 10. 風險與合規

- **PCI**：絕不收取或儲存卡號，全程透過 Stripe Elements + SetupIntent
- **GDPR / 個資**：使用者可請求刪除帳號 → 級聯刪除所有資料（含 Stripe customer）
- **密碼儲存**：argon2id，memoryCost 64MB、timeCost 3、parallelism 4
- **JWT 簽章金鑰**：放 secret manager，每 90 天輪換
- **OAuth secret**：絕不寫進程式碼，走環境變數
- **rate limit**：所有 auth 端點預設 token bucket，避免帳號列舉

## 11. 給 AI 開發的提示

> 此段給 AI Agent 看，加速接手

- BE 與 FE **平行開發**，由 OpenAPI 作為契約
- BE 順序建議：
  1. DB schema + migration
  2. `/auth/register` + 測試
  3. `/auth/login` + `/auth/refresh` + 測試
  4. Google OAuth + 測試
  5. 2FA enroll + verify + 測試
  6. Stripe SetupIntent + webhook + 測試
  7. payment methods CRUD + 測試
- 每完成一段就 commit + push，AI Review 即時跑
- 寫測試時務必覆蓋上方所有 AC 編號（測試名直接帶 AC-XX）
