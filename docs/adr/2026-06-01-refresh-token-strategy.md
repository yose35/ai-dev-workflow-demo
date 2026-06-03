# ADR-002: Refresh Token 策略

- 日期：2026-06-01
- 狀態：Accepted
- 決策者：AI Agent + 待 BE Lead 確認

## Context

Spec AC-L1 / AC-L4 要求登入時簽發 refresh token（30 天），且需安全地保存與輪換。
需決定：(a) token 形式與儲存位置；(b) refresh 時是否輪換；(c) 被偷竊時如何處理。

## Options

### A：JWT refresh + 短效期
直接用 JWT 當 refresh，無 DB 紀錄。
- 優：無狀態
- 缺：無法強制撤銷，被偷只能等過期

### B：Opaque random token + DB hash + rotation
產隨機 32 bytes，DB 存 SHA-256 hash，每次 refresh 換新並撤銷舊。
- 優：可撤銷、DB 外洩不直接洩漏 token
- 缺：每次 refresh 需 DB 寫入

### C：Opaque + rotation + reuse detection
B 加上「已撤銷的 token 再用 → 視為偷竊，撤銷全部 session」。
- 優：對 token theft 有即時防禦
- 缺：合法使用者若離線太久也可能誤判（罕見）

## Decision

**選 Option C。**

實作要點：
1. `crypto.randomBytes(32)` → hex 字串給 client
2. DB 存 SHA-256 hash（不可逆）
3. 透過 httpOnly + Secure + SameSite=Strict cookie 傳遞，path=`/auth`
4. 每次 `/auth/refresh` 立即將舊 token revokedAt 設為現在，產生新 token
5. 若收到 `revokedAt != null` 的 token → 將該 user 所有 `revokedAt = null` 的 token 全部撤銷
6. `/auth/logout` 撤銷當前 cookie 對應的 token

## Consequences

- 正面：被偷的 session 在攻擊者使用第一次後立即失效；合法使用者下次操作會被登出，發現異常
- 負面：使用者若在多裝置同時開機後突然網路飆異，邊界 case 可能被誤判（極低機率）
- 待辦：未來可加 device fingerprint 降低誤判；可在 logout 後一段時間內保留紀錄供稽核

## References

- Spec: `specs/login-and-payment.md` AC-L1 / AC-L4 / 第 8 節
- 實作：`apps/api/src/lib/refreshToken.ts`
- OWASP Cheat Sheet: JWT for Session Management
