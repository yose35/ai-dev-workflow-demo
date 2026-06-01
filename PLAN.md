# PLAN.md — 進行中工作（活文件）

> 這是團隊與 AI 共用的「白板」。任何人或 AI 開工前更新「下一步」，做完劃掉。
> 用 commit 一起 push，等於把開發思路存進 git history。

---

## 當前 Sprint 目標

<填：本週/本 sprint 要交付什麼。例：完成登入功能 BE，可串 FE mock>

## 進行中的 Ticket

### `<TICKET-001>` — <ticket 標題>

- **負責人**：<人名 / AI>
- **Spec 連結**：`specs/<feature>.md`
- **狀態**：In progress
- **API Contract**：`packages/contract/openapi.yaml` 第 N 行

#### 已完成
- [x] 讀規格、確認 acceptance criteria
- [x] 設計 DB schema（見 `docs/adr/2026-06-01-user-schema.md`）
- [x] 寫 migration `20260601_users.sql`

#### 進行中
- [ ] 實作 `POST /auth/register` handler
- [ ] 補 unit test

#### 下一步（最重要！）
> AI 與工程師都先看這段
1. 完成 `POST /auth/register` 與測試
2. 接著做 `POST /auth/login`，沿用同一份 validator
3. 第一個 PR 切點：含 register + login + 完整測試，可獨立 merge

#### 已知未決
- 密碼 hash 用 argon2id 還是 bcrypt？傾向 argon2id（見 ADR 草稿）
- refresh token 放 httpOnly cookie 還是 localStorage？需確認 FE 端意見

#### 阻塞
- 等 PM 確認「忘記密碼」是否本 sprint 範圍

---

## 已完成的 Ticket（本 sprint）

- <TICKET-000> 建立 repo、配置 CI、設定 monorepo —— 2026-05-30

---

## 決策紀錄索引（最近）

- `docs/adr/2026-06-01-user-schema.md` — User table 設計
- `docs/adr/2026-05-30-monorepo-tool.md` — 為何選 pnpm workspace

---

## AI 接手清單

當 AI 從 0 開始接手此檔案：
1. 讀「當前 Sprint 目標」確認大方向
2. 看「進行中的 Ticket → 下一步」決定要做什麼
3. 看「已知未決」與「阻塞」避免重複踩坑
4. 動工前更新本段為「In progress」並寫出你的子計畫
5. 每完成一小段，把「進行中」項目劃掉並 commit
