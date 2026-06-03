# GitHub Repo 設定指南

> 目的：把 workflow kit 套用到實體 repo，啟用 AI Review、Auto-fix CI。
> **建議時間：20 分鐘**

---

## 0. 前置作業

- [ ] 有 GitHub 組織 / 帳號（建議用組織，方便管理 secrets）
- [ ] 本機已安裝 `git` 與 `gh` CLI（可選但推薦）
- [ ] 有 Anthropic API key（[Console](https://console.anthropic.com/) → API Keys）

---

## 1. 建立 repo

### 方法 A：用 GitHub 網站
1. 進 https://github.com/new
2. 名稱建議：`ai-dev-workflow-demo`
3. 設為 **Private**（demo 期間）
4. 勾選 **Add a README**
5. 建立

### 方法 B：用 gh CLI
```bash
gh repo https://github.com/yose35/ai-dev-workflow-demo.git --private --add-readme --clone
cd ai-dev-workflow-demo
```

---

## 2. 把 workflow kit 內容放進 repo

```bash
# 假設 workflow-kit 在你電腦的某個位置
cp -r /path/to/workflow-kit/* .
cp -r /path/to/workflow-kit/.github .

# 應該看到的結構：
# .
# ├── CLAUDE.md
# ├── PLAN.md
# ├── README.md          ← 來自 workflow-kit
# ├── .github/
# │   ├── PULL_REQUEST_TEMPLATE.md
# │   └── workflows/
# │       ├── ai-review.yml
# │       └── ai-test-and-fix.yml
# ├── docs/
# │   ├── setup-notion.md
# │   ├── setup-github.md
# │   └── templates/
# └── specs/
#     └── login-and-payment.md

git add .
git commit -m "chore: bootstrap with AI Dev Workflow Kit"
git push origin main
```

---

## 3. 設定 secrets

到 repo 的 **Settings → Secrets and variables → Actions → New repository secret**：

| Secret 名稱 | 來源 | 用途 |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | AI Review / Auto-fix |
| `STRIPE_SECRET_KEY` | Stripe Dashboard 測試模式 | 開發階段 |
| `STRIPE_WEBHOOK_SECRET` | Stripe CLI / Dashboard | 接 webhook |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud Console | Google 登入 |
| `GOOGLE_OAUTH_CLIENT_SECRET` | 同上 | 同上 |
| `DATABASE_URL` | 本地 / 開發環境 PG | 整合測試 |

> **重要**：本機 `.env` 不要 commit，但 `.env.example` 一定要 commit（記住所有變數名）。

---

## 4. 設定 branch protection（main）

**Settings → Branches → Add branch protection rule**

- Branch name pattern: `main`
- 勾選：
  - ✅ Require a pull request before merging
    - Require approvals: **1**
    - Dismiss stale approvals when new commits are pushed
  - ✅ Require status checks to pass before merging
    - 加入 `test`、`ai-review`
  - ✅ Require conversation resolution before merging
  - ✅ Require linear history（避免 merge commit 亂掉 AI 解讀）
- 不要勾「Include administrators」（緊急時可繞）

---

## 5. 設定 labels

**Issues → Labels → New label** — 建議至少建：

| Label | 顏色 | 用途 |
|---|---|---|
| `ai-generated` | 紫 #7c3aed | 標記 AI 提的 PR |
| `human-reviewed` | 綠 #10b981 | 經過人類最終 review |
| `skip-ai-review` | 灰 #9ca3af | 緊急、跳過 AI review |
| `skip-auto-fix` | 灰 #9ca3af | 跳過自動修 |
| `phase-1` / `phase-2` ... | 藍 #3b82f6 | 對應 demo phase |

---

## 6. 啟用 GitHub Actions

預設啟用，但確認：

- **Settings → Actions → General**
  - Actions permissions: **Allow all actions and reusable workflows**
  - Workflow permissions: **Read and write permissions**（auto-fix 需要寫入）
  - ✅ Allow GitHub Actions to create and approve pull requests

---

## 7. 第一次驗證

```bash
git checkout -b test/first-pr
echo "# Hello AI" >> README.md
git add . && git commit -m "test: trigger first AI review"
git push -u origin test/first-pr
gh pr create --title "Test AI workflow" --body "Verifying AI Review fires"
```

進到 PR 頁面，應該看到：
- ✅ `test` job 跑起來
- ✅ `ai-review` job 出現
- 5–10 分鐘內 AI 在 PR 上留 review comment

如果 ai-review 沒跑：
1. 確認 `ANTHROPIC_API_KEY` secret 名稱完全一致（區分大小寫）
2. 看 Actions tab 的 log，通常是 API 額度或權限問題

---

## 8. 加 Linear / Notion 整合（可選但推薦）

Linear 已可透過 Claude MCP 直接讀寫（上方有 connector 建議卡），這意味著：
- AI 開 PR 時可自動帶 `Closes LIN-123`
- merge 後自動把 Linear ticket 轉成 Done

Notion 同理 — AI 寫完 ADR 後同步建立 Notion 紀錄。

---

## 9. Demo 結束後的清理

- demo 用 repo 可保留作為 reference
- 真正導入時，建議在 **template repo**（GitHub 的 template feature）上做，新專案點一下就有整套
- 預算通過後，把 workflow-kit fork 進公司 org，所有專案 `git submodule add`

---

## 常見問題

**Q：AI Review 會看到敏感程式碼嗎？**
A：會看到 PR diff。敏感 repo 建議在 Anthropic Console 開啟 zero-retention 模式，或用 Anthropic 的 enterprise plan。

**Q：自動修壞了 main 怎麼辦？**
A：Branch protection 已要求 PR + 1 approval，AI 修在 PR 分支，merge 仍由人決定。風險可控。

**Q：費用怎麼算？**
A：以登入 + 付款這個專案估算，AI Review + Auto-fix 全程約 200–500 美元（Sonnet）。每月 demo 後對照節省的工時，ROI 通常 5–20 倍。
