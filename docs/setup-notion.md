# Notion Workspace 設定指南

> 目的：建立 AI 與團隊共用的知識中樞。AI 會自動寫入 / 讀取以下 databases。
> **建議時間：30 分鐘**

---

## 0. 前置作業

- [ ] 已在上方面板點「Connect Notion」連接 MCP（已替你準備好建議卡片）
- [ ] 確定一個專屬於此 workflow 的 Notion 頁面，例如 `AI Dev Workflow`
- [ ] 該頁面已邀請 Claude integration 為協作者（連接時會詢問權限範圍）

---

## 1. 建立四個 Database

在 `AI Dev Workflow` 頁面下建立以下四個 database。每個 database 後面附 **建議屬性**，先這樣建，之後可調。

### Database 1: `Specs`（產品規格）

| 屬性名稱 | 類型 | 用途 |
|---|---|---|
| Title | Title | 規格名稱 |
| Status | Select | Draft / In Review / Approved / Deprecated |
| Owner | Person | PM 負責人 |
| Version | Text | 例：v0.1 |
| Linear / Jira | URL | Epic 連結 |
| Figma | URL | 設計稿 |
| Repo Path | Text | `specs/<feature>.md` |
| Updated | Last edited time | 自動 |

> AI 行為：寫好 PRD 後同步建立此處紀錄，repo 與 Notion 雙寫。

### Database 2: `ADRs`（架構決策）

| 屬性名稱 | 類型 | 用途 |
|---|---|---|
| Title | Title | 決策名稱（含編號）例：ADR-007 採用 argon2id |
| Status | Select | Proposed / Accepted / Superseded |
| Decided On | Date | 決定日期 |
| Decision Makers | Multi-person | 參與決議者 |
| Supersedes | Relation → ADRs | 取代了哪個 |
| Repo Path | Text | `docs/adr/<日期>-<名>.md` |
| Tags | Multi-select | security / perf / db / api / infra |

> AI 行為：每次重大決策成案後寫入這裡，並將 markdown commit 進 repo。

### Database 3: `Sprint Plans`（活動的進度紀錄）

| 屬性名稱 | 類型 | 用途 |
|---|---|---|
| Title | Title | 例：2026-06 Sprint 23 |
| Goal | Text | 本 sprint 主軸 |
| Status | Select | Planned / In Progress / Closed |
| Start / End | Date range | 起訖 |
| Repo Path | Text | `PLAN.md` 連結 |
| Retro Notes | Text | sprint 結束後寫感想 |

> AI 行為：每次更新 `PLAN.md` 時，把摘要也同步到對應 row。

### Database 4: `Run Log`（AI 工作紀錄 — 給 ROI 報告用）

| 屬性名稱 | 類型 | 用途 |
|---|---|---|
| Title | Title | 例：Generate OpenAPI for login |
| Phase | Select | Spec / Plan / Code / Review / Test / Fix / CI |
| Ticket | URL | 對應 Linear/Jira |
| Started | Date | 開工時間 |
| Ended | Date | 完工時間 |
| Duration (min) | Number | 用於 ROI 統計 |
| AI Tokens | Number | 估算成本用 |
| Outcome | Select | Success / Partial / Failed |
| Notes | Text | 失敗原因或亮點 |

> AI 行為：每次完成一個小段落，自動寫一筆。**這就是月底 ROI 報告的原料。**

---

## 2. 把 databases 命名好，讓 AI 認得

每個 database 的內部 URL 帶有 ID，建議把名稱寫死（不要事後改）並把 URL 記在 repo 的 `CLAUDE.md` 下：

```md
## Notion 整合
- Specs DB: https://www.notion.so/.../<id>
- ADRs DB: https://www.notion.so/.../<id>
- Sprint Plans DB: https://www.notion.so/.../<id>
- Run Log DB: https://www.notion.so/.../<id>
```

AI 透過 MCP 工具會用 ID 取出對應 database，不依賴名稱。

---

## 3. 權限設定

- 此頁面與底下所有 databases 都要分享給 **Claude integration**（連 MCP 時跳的權限框）。
- 若公司有 SSO 限制，請 Notion admin 在 Settings → Connections 把 Claude 列入允許。
- 一般 team member 給 **Edit** 權，AI bot 給 **Edit**（要能寫入）。

---

## 4. 驗證設定完成

連完 Notion MCP 後，可以直接在 chat 對我說：
> 「在 Specs DB 建一筆叫 login-and-payment 的測試紀錄，建完刪掉。」

我會跑一輪 search → create → archive，確認 AI 寫入路徑通了。

---

## 5. 進階：自動化模板

之後可以在每個 Sprint Plans row 下加 sub-page 自動模板（Notion 內建 button），結構參考 repo 內 `PLAN.md`。目前先手動同步，等流程穩了再做。
