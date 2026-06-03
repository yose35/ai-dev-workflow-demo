# ADR-003: Google OAuth 整合策略

- 日期：2026-06-02
- 狀態：Accepted
- 決策者：AI Agent + 待 BE Lead 確認

## Context

Spec AC-L3 / US-2 要求支援 Google 登入。需決定：
- (a) 用哪種 OAuth flow（Authorization Code vs Implicit vs One Tap）
- (b) CSRF state 如何驗證（BE 是否需要狀態儲存）
- (c) 新 / 舊使用者如何 reconcile

## Options

### A：Authorization Code (server side)
FE 取 code，BE 用 code 換 token，BE 自己呼叫 Google userinfo。
- 優：tokens 永不到瀏覽器
- 缺：流程長、需保管 client_secret

### B：FE 拿 id_token (One Tap / GIS) → POST 給 BE
FE 直接拿 id_token，BE 用 Google JWKS 驗章。
- 優：流程短、無 client_secret 在 BE 跑時 secret 仍由 Google 簽
- 缺：id_token 短時間內出現在瀏覽器（一般可接受）

### C：完全 server-driven (PKCE)
- 優：最完整
- 缺：對 demo 過度設計

## Decision

**選 Option B（FE 拿 id_token + BE 驗章）。**

**CSRF state：用 HMAC-簽署的 nonce + exp token**（不需 BE state store）
1. FE 呼叫 `GET /auth/google/state` 取得 `state`
2. FE 在 Google 重導時帶 `state`
3. Google 回呼後 FE 把 id_token + state 一起 POST 到 `/auth/google`
4. BE：
   a. 驗 state HMAC + 未過期（5 分鐘 TTL）
   b. 用 `google-auth-library` 驗 id_token（含 audience 比對）
   c. 找 user：先以 `(oauth_provider, oauth_sub)` 查；找不到就用 email link 既有帳號；都不到就建新 user

## Consequences

- 正面：BE 無狀態、可水平擴展；id_token 由 Google 簽不可偽造
- 負面：
  - 若使用者 Google email 改變但 Google sub 不變，能繼續登入（正確行為）
  - 若使用者改用其他帳號的 Google email（罕見），會 link 到舊帳號 → 風險可接受，可在 settings 加「斷開連結」
- 待辦：
  - 後續 spec 若要支援 Apple/Facebook，重構為 `identities` 表（依 ADR-001 預留）
  - 改 Google email_verified 為 false 時拒絕登入（已在 verifier 實作）

## References

- Spec: `specs/login-and-payment.md` AC-L3 / § 8
- 實作：
  - `apps/api/src/lib/csrfState.ts`
  - `apps/api/src/lib/googleOAuth.ts`
  - `apps/api/src/routes/auth/google.ts`
- 測試：8 個 case 涵蓋 AC-L3a/b/c + state 失效 + token 失效 + 安全性
