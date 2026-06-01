# Spec — <功能名稱>

> 此檔是 AI 與工程師的唯一需求來源。PM、設計、技術一起在此對齊。
> 開發開始後，**任何需求變動必須改這份檔**，並標註版本。

- **作者**：<PM 名字>
- **狀態**：Draft / In Review / Approved / Deprecated
- **版本**：v0.1 — 2026-06-01
- **Linear Epic**：<連結>
- **Figma**：<連結>

---

## 1. 為何要做（Why）

<2–3 句說明此功能解決什麼問題，對哪個業務指標有幫助>

## 2. 不做什麼（Out of scope）

- <列出明確不在本次範圍的事項，避免漏接>

## 3. 使用者故事

```
作為 <角色>，
我想要 <做什麼>，
以便 <達到什麼目的>。
```

## 4. Acceptance Criteria（驗收條件）

> 用 Given / When / Then 格式，AI 會直接由此產測試案例

- **AC1**：
  - Given <前置條件>
  - When <動作>
  - Then <預期結果>
- **AC2**：...

## 5. UI / UX

- Figma：<frame 連結>
- 重點互動：<列出>
- 錯誤與空狀態：<列出>

## 6. 資料模型（草稿）

```
User
  id            uuid pk
  email         text unique
  password_hash text
  created_at    timestamptz
```

## 7. API 端點（草稿）

| Method | Path | 用途 |
|---|---|---|
| POST | /auth/register | 註冊 |
| POST | /auth/login | 登入 |

> 正式 contract 開發階段會放 `packages/contract/openapi.yaml`

## 8. 邊界與異常

- <例：同一 email 重複註冊 → 回 409 USER_EXISTS>
- <例：密碼少於 8 字 → 回 400 WEAK_PASSWORD>

## 9. 量測（埋點 / 指標）

- 事件：`auth.register.completed`、`auth.login.failed`
- 監控指標：登入成功率、註冊轉換率

## 10. 風險與合規

- <例：付款資料絕不落地，全程透過 Stripe Elements>
- <例：歐盟使用者需符合 GDPR cookie consent>
