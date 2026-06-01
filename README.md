# AI Dev Workflow Kit

> 一套可重複使用的開發流程框架。**任何新專案複製這個資料夾，就具備完整 AI 協作能力。**

## 為什麼用這套

- **每個專案立即可用**：把這套丟進 repo 就有了 AI 脈絡、PR 自動 review、自動測試修復
- **知識複利**：`CLAUDE.md` + `PLAN.md` 累積成團隊資產，新人與 AI 接手都更快
- **流程一致性**：不再每個專案發明一遍規矩，新人加入學一次就會所有專案
- **可量測**：每個階段都有打點，月底自動產 ROI 報告

## 套件內容

```
workflow-kit/
├── README.md                              ← 你正在看的文件
├── CLAUDE.md                              ← 每個專案的 AI 脈絡（必填）
├── PLAN.md                                ← 進行中工作的活文件（隨工作更新）
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md           ← PR 標準格式
│   └── workflows/
│       ├── ai-review.yml                  ← AI 自動 review PR
│       └── ai-test-and-fix.yml            ← CI 失敗自動分析與修復
├── docs/
│   └── templates/
│       ├── spec-template.md               ← PRD 範本
│       └── adr-template.md                ← 架構決策紀錄範本
└── specs/                                 ← 放各功能的 PRD
```

## 安裝（新專案）

```bash
# 1. 把這套丟進你的 repo 根目錄
cp -r workflow-kit/* your-repo/
cp -r workflow-kit/.github your-repo/

# 2. 填好 CLAUDE.md 的專案速覽、技術棧、目錄結構

# 3. 在 GitHub repo settings 設定 secret
#    ANTHROPIC_API_KEY = sk-ant-...

# 4. 推上去，第一個 PR 就會自動跑 AI review
```

## 各檔案責任

| 檔案 | 誰維護 | 何時更新 |
|---|---|---|
| `CLAUDE.md` | Tech Lead | 架構或慣例變動時 |
| `PLAN.md` | 任何人 / AI | 每次開工、進度變動時 |
| `specs/<feature>.md` | PM | 寫 / 改需求時 |
| `docs/adr/<日期>-<名>.md` | 提議人 | 重大決策成案時 |
| GitHub workflow | DevOps | 工作流調整時 |

## 工作流總覽

1. **Spec 進來** → PM 用 `spec-template.md` 寫進 `specs/`
2. **規劃** → AI 讀 spec，更新 `PLAN.md`、開 Linear ticket
3. **開發** → AI 與工程師依 `PLAN.md → 下一步` 推進，每段落 commit
4. **PR** → 自動跑 `ai-review.yml` 給初步 review
5. **測試** → `ai-test-and-fix.yml` 跑全套，失敗自動嘗試修
6. **Merge** → 觸發部署、AI 摘要本次變更
7. **監控** → Sentry 出問題自動建 Linear ticket，回到第 1 步

## 給團隊新人的 onboarding 流程

1. 讀本 README（10 分鐘）
2. 讀你要加入的專案的 `CLAUDE.md`（5 分鐘）
3. 看 `PLAN.md` 知道目前在幹嘛（5 分鐘）
4. 從「下一步」挑一個小項認領
5. 把 `PLAN.md` 標記為自己 in progress 後開工
6. 卡關時，AI 可以基於上述脈絡直接協助，不用再從 0 解釋

> **20 分鐘內讓新人理解專案 + 開始貢獻**，這就是這套框架的 ROI。

## 推進建議

從一個專案開始（建議：登入功能 demo），跑完一輪後做 retro，調整本 kit 再推給其他專案。**不要一次全公司推。**

## 量測

每月初由 AI 從 Linear / GitHub Actions / Sentry 抓資料，產出：
- 各專案的 cycle time（spec → deploy）
- AI Review 抓到的問題數 / 人類抓到的問題數
- Auto-fix 成功率
- 工程師打斷次數（context switch）
- 對照人工流程的時間節省

這份報告就是給高層看的 ROI 證據。
