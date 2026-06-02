# ADR-005: Stripe 整合與付款資料策略

- 日期：2026-06-02
- 狀態：Accepted
- 決策者：AI Agent + 待 BE Lead 確認

## Context

Spec AC-PAY-1..5 / § 10：
- 必須支援卡片綁定（後續訂閱用）
- **絕不收 / 不存卡號（PCI 合規）**
- webhook idempotency by `event.id`

## Options

### A：Stripe Checkout（hosted）
讓 Stripe 自己掛頁面收卡片。
- 優：PCI 範圍最小
- 缺：UX 跳離我們的 App

### B：Stripe Elements + SetupIntent（in-app）
FE 用 Stripe Elements 直接收卡片資料丟給 Stripe，BE 完全不碰卡號。
- 優：UX 在自家、PCI 範圍仍小（SAQ A）
- 缺：稍微複雜

### C：自架收 PAN
- 不考慮：PCI Level 1 工程量巨大

## Decision

**選 Option B（Stripe Elements + SetupIntent）。**

### 流程
1. FE 呼叫 `POST /payments/setup-intent` → BE 建 SetupIntent → 回 `client_secret`
2. FE 用 Stripe Elements 收卡，confirm SetupIntent
3. Stripe 端成功 → 觸發 webhook `setup_intent.succeeded`
4. BE 在 webhook handler 中：
   - 驗 `Stripe-Signature`
   - 以 `event.id` 做 idempotency
   - 拉 `payment_method` 詳情（brand/last4/exp）寫入 `payment_methods` 表
5. FE 透過 `GET /payments/methods` 查列表

### Idempotency 實作
- in-memory LRU Set 紀錄 processed event.id（10k entries）
- 多實例 / 持久化 → 下個 sprint 換 Redis 或 `processed_events` 表

### 安全 / 合規
- **DB 僅存**：`stripe_payment_method_id`、`brand`、`last4`、`exp_month`、`exp_year`
- **絕不存**：PAN、CVV、完整 expiry 以外資訊
- webhook 必驗 signature；驗失敗回 400 不洩漏細節
- `findUnique` 找不到 / 不屬於使用者 → 一律回 404，避免存在性洩漏

## Consequences

- 正面：
  - PCI 範圍維持在 SAQ A
  - 卡片資訊變動完全由 Stripe 端管（換卡、過期通知等可走 webhook 自動同步）
- 負面：
  - 強依賴 Stripe，若要換 PSP 需重做
  - in-memory idempotency 在多實例會失效 → 重要的限制需在進入生產前修
- 待辦：
  - 下個 sprint：idempotency 改 Redis / DB
  - 加 `customer.subscription.*` webhook 處理（訂閱方案上線後）
  - 加 default payment method 切換 endpoint

## References

- Spec: `specs/login-and-payment.md` AC-PAY-1..5, § 10
- Stripe SetupIntent API: https://docs.stripe.com/payments/save-and-reuse
- 實作：
  - `apps/api/src/lib/stripe.ts`
  - `apps/api/src/lib/webhookIdempotency.ts`
  - `apps/api/src/routes/payments/setupIntent.ts`
  - `apps/api/src/routes/payments/methods.ts`
  - `apps/api/src/routes/payments/webhook.ts`
