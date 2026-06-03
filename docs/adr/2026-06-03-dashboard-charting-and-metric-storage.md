# ADR: Dashboard 圖表庫選 recharts、KPI 金額以分(cent)存 bigint

- 日期：2026-06-03
- 狀態：Accepted
- 決策者：AI Agent + ethanfang
- 雙寫：Notion ADRs DB（同名頁）

## Context（背景）

營運 KPI 儀表板（DASH-001，見 `specs/dashboard-kpi.md`）需要：
1. 前端畫 sparkline + 多張折線圖（含 0 基準線、tooltip、響應式）。
2. 後端彙總 Wager / GGR 等金額，並算 `Margin = GGR/Wager`、`ATPPU = ValidWager/PlayerCount` 這類除法指標。

兩個決策需先定案，BE / FE 才好開工。

## Decision 1：圖表庫選 recharts

### Options
- **recharts**：React 生態最常用、聲明式 API、與 Next.js 15 + TS 相容、折線/參考線/ResponsiveContainer 開箱即用。
- **visx + d3**：最彈性、可高度客製，但要寫較多程式。
- **Chart.js**：成熟，但 canvas 取向、與 React 整合較鬆散。

選 **recharts**：開發成本低、與截圖視覺一致、第一期需求單純（折線 + sparkline）。

### Consequences
- ＋ 快速交付，bundle 影響可接受（`/dashboard` 約 112KB）。
- － 未來若需高度客製互動可能要轉 visx；jsdom 測試下無布局會出 `width(-1)` warning（無害）。

## Decision 2：KPI 金額以「分(cent)」存 bigint

### Options
- **浮點 / decimal 存「元」**：直覺，但彙總與比值會累積浮點誤差，Margin / ATPPU 易飄移。
- **整數存「分」(bigint)**：精確，回傳前才轉「元」。

選 **整數存分**：彙總表 `daily_brand_metrics` 金額欄一律 bigint（cent）；Margin / ATPPU 為衍生值不落地，由 API 計算；回傳前轉「元」。

### Consequences
- ＋ 避免 Margin / ATPPU 浮點漂移，符合 CLAUDE.md「付款資料用整數」精神。
- － BE/FE 需記得「存分、傳元」的轉換點（已在 `apps/api/src/lib/metrics.ts` 集中處理）。
- 待辦：demo 於 JS 端彙總（~180 列）；正式環境應將 `GROUP BY` 下推 DB（另開 ADR 追蹤）。

## References

- 相關 Spec：`specs/dashboard-kpi.md`、Notion Specs DB「營運 KPI 儀表板」
- 相關 ticket：DASH-001
- 相關 PR：#3（資料層+API+contract）、#4（前端頁面）
