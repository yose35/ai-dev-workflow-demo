# Spec — 營運 KPI 儀表板（Dashboard KPI Overview）

> 此檔是 AI 與工程師的唯一需求來源。PM、設計、技術一起在此對齊。
> 開發開始後，**任何需求變動必須改這份檔**，並標註版本。

- **作者**：（PM 待填）
- **狀態**：Draft
- **版本**：v0.1 — 2026-06-03
- **Linear Epic**：<連結>
- **Figma**：<連結>（目前以既有儀表板截圖為準）

---

## 1. 為何要做（Why）

營運 / 商務團隊需要每天盯各遊戲品牌（Choice / Eeze / Lucky）的核心營收與用戶指標，目前要手動撈 DB 拼 Excel，慢又容易錯。
本功能提供一個**唯讀的 KPI 儀表板**：上方 7 張 KPI 卡（含環比箭頭與迷你走勢），下方多分頁折線圖，支援品牌篩選與「本期 vs 比較期」。
**業務指標**：縮短營運看數的 cycle time、讓 GGR / Margin 異常能當天被發現。

## 2. 不做什麼（Out of scope）

- **不做寫入 / 編輯**：純讀取分析，不調整任何營運資料。
- **不做即時（real-time）串流**：資料以「日」為最小粒度，由每日批次彙總（本期先用 seed 假資料）。
- **不做使用者自訂報表 / 拖拉式 widget**：版面固定。
- **不做匯出 PDF / Excel**：第二期再評估。
- **不做權限分級**：第一期假設登入者皆可看全部品牌（沿用現有 JWT 驗證即可）。
- **不接真實金流 / 遊戲日誌**：資料來源為彙總表，由 seed 腳本產生示範資料。

## 3. 使用者故事

```
作為 營運分析師，
我想要 在一個畫面看到各品牌本週的 Wager、GGR、Margin 等核心指標與環比變化，
以便 快速判斷哪個品牌表現異常、是否要介入。
```

```
作為 商務主管，
我想要 切換品牌與時間區間並看到折線趨勢圖，
以便 在週會上用同一份數據對齊團隊。
```

## 4. 指標定義（Metric Definitions）

> 先把「7 張卡」的定義講清楚，AI 與工程師才不會算錯。金額單位：USD，顯示時以 K 縮寫。

| 指標 | 全名 | 定義 / 公式 | 型別 |
|---|---|---|---|
| Wager | 總投注額 | 區間內所有投注金額加總 | 金額 |
| Valid Wager | 有效投注額 | 符合洗碼條件的投注金額加總（≤ Wager） | 金額 |
| GGR | Gross Gaming Revenue | `Wager − Payout`（玩家輸給莊家的淨額，可為負） | 金額（可負） |
| Margin | 莊家利潤率 | `GGR / Wager × 100%`（可為負） | 百分比 |
| Player Count | 活躍玩家數 | 區間內有下注的不重複玩家數 | 整數 |
| Bet Count | 投注筆數 | 區間內投注次數加總 | 整數 |
| ATPPU | Avg Total Payment Per User | `Valid Wager / Player Count`（人均有效投注） | 金額 |

- **環比（Comparison）**：預設 WoW（Week over Week）= 本期往前推一個等長區間。變化率 `(本期 − 比較期) / |比較期| × 100%`。
- **箭頭顏色**：上升綠、下降紅；但 GGR / Margin 對莊家是「越高越好」，Player/Bet/Wager 也是越高越好，故一律「上升=綠」。（負值指標的方向另在 §8 說明。）

## 5. UI / UX

版面對齊提供的截圖，由上而下三區：

### 5.1 頂部控制列
- **品牌篩選 chips**：`All` / `Choice` / `Eeze` / `Lucky`，可單選或多選（多選時 KPI 為加總）。預設 `All`。
- **時間區間**：`Current`（本期，預設最近 7 天）+ `Comparison`（比較期，預設 WoW 自動帶前一週）。可改 Daily/Weekly/Monthly 對應預設長度。
- **Last updated** 時間戳（資料彙總時間，UTC 顯示）。

### 5.2 KPI 卡片區（7 張，可橫向捲動）
每張卡含：指標名 + 主數值（K 縮寫）+ 環比百分比（含↑↓箭頭與顏色）+ `vs <比較期值> Comp Period` + **迷你 sparkline**（本期逐日走勢）。

### 5.3 圖表區（Chart View）
- 分頁 tabs：`Revenue Volume`（本期先做）/ `User Growth` / `User Engagement` / `Monetization`（後三者第二期）。
- `View by` 切換：`Day` / `Week` / `Month`。
- **Revenue Volume** 分頁含 4 張折線圖（2×2）：
  1. **Wager Volume Analysis** — Wager 折線 + ATPPU 對照虛線
  2. **Valid Wager Analysis** — Valid Wager 折線 + Avg Valid Wager 對照虛線
  3. **Margin** — Margin% 折線（含 0 基準虛線）
  4. **GGR** — GGR 折線（含 0 基準虛線）

### 5.4 狀態
- **載入中**：KPI 卡與圖表顯示 skeleton。
- **空狀態**：選定區間無資料 → 卡片顯示 `—`，圖表顯示「此區間無資料」。
- **錯誤**：API 失敗 → 顯示重試按鈕 + 錯誤碼。

## 6. 資料模型（草稿）

新增一張「每日 × 品牌」彙總表（彙總後的事實表，非原始日誌）。沿用現有 Prisma + Postgres、snake_case `@map` 慣例。

```
DailyBrandMetric  (daily_brand_metrics)
  id           uuid        pk
  date         date                       -- 該日（UTC 日界）
  brand        text                       -- 'choice' | 'eeze' | 'lucky'（enum 約束見 §8）
  wager        bigint                     -- 以「分」為單位存整數，避免浮點誤差
  valid_wager  bigint
  ggr          bigint                     -- 可為負
  payout       bigint                     -- wager - ggr，存起來方便驗算
  player_count int
  bet_count    int
  created_at   timestamptz default now()

  @@unique([date, brand], name: "uq_metric_date_brand")
  @@index([brand, date])
```

- **金額一律以「分（cent）」存 bigint**，回傳前端時再轉浮點 / K 縮寫，符合 CLAUDE.md「付款資料用整數」精神、避免 Margin 計算飄移。
- Margin、ATPPU 為**衍生值不落地**，由 API 計算。
- 後續若要真實資料，由 ETL 寫入此表；本期由 seed 腳本產生 ~60 天 × 3 品牌示範資料。

## 7. API 端點（草稿）

統一回應格式沿用專案慣例 `{ ok, data }` / `{ ok:false, error:{ code, message } }`，皆需 JWT（沿用 `requireAuth`）。

| Method | Path | 用途 |
|---|---|---|
| GET | `/metrics/kpi` | 回 7 張 KPI 卡的本期值、比較期值、變化率、sparkline |
| GET | `/metrics/timeseries` | 回指定指標的逐點時間序列（給折線圖） |

### 7.1 `GET /metrics/kpi`

Query：

| 參數 | 必填 | 說明 | 預設 |
|---|---|---|---|
| `from` | ✓ | 本期起日（YYYY-MM-DD, UTC） | — |
| `to` | ✓ | 本期迄日（含） | — |
| `compareFrom` | | 比較期起日 | 自動 WoW（往前一個等長區間） |
| `compareTo` | | 比較期迄日 | 自動 WoW |
| `brands` | | 逗號分隔 `choice,eeze,lucky`，省略=全部 | 全部 |
| `granularity` | | `day`/`week`/`month`（影響 sparkline 點數） | `day` |

Response `data`：
```jsonc
{
  "lastUpdated": "2026-06-02T20:19:01Z",
  "period":  { "from": "2026-05-27", "to": "2026-06-02" },
  "compare": { "from": "2026-05-20", "to": "2026-05-26" },
  "kpis": {
    "wager":       { "value": 7397000, "compare": 2961000, "changePct": 149.8, "spark": [/* 逐日 */] },
    "validWager":  { "value": 4065000, "compare": 2452000, "changePct": 65.8,  "spark": [] },
    "ggr":         { "value": -4722000,"compare": -6078000,"changePct": 22.3,  "spark": [] },
    "margin":      { "value": -63.83,  "compare": -205.29, "changePct": 68.9,  "spark": [] },
    "playerCount": { "value": 162,     "compare": 93,      "changePct": 74.2,  "spark": [] },
    "betCount":    { "value": 16901,   "compare": 15499,   "changePct": 9.0,   "spark": [] },
    "atppu":       { "value": 45664,   "compare": 31837,   "changePct": 43.4,  "spark": [] }
  }
}
```
> 金額欄位以「元」回傳（已由分換算），前端負責 K 縮寫與顏色。

### 7.2 `GET /metrics/timeseries`

Query：`from`,`to`,`brands`,`granularity` 同上，外加 `metrics`（逗號分隔，如 `wager,validWager,ggr,margin`）。

Response `data`：
```jsonc
{
  "granularity": "day",
  "points": [
    { "bucket": "2026-05-27", "wager": 2734000, "validWager": 1800000, "ggr": -900000, "margin": -32.9 },
    { "bucket": "2026-05-28", "wager": 1720000, "validWager": 1200000, "ggr": -500000, "margin": -29.1 }
    // ...
  ]
}
```

> 正式 contract 開發階段會放 `packages/contract/openapi.yaml`（新增 `Metrics` tag 與上述兩端點 + schema）。

## 8. 邊界與異常

- `from > to` → 400 `INVALID_DATE_RANGE`。
- 區間過大（> 366 天）→ 400 `RANGE_TOO_LARGE`（避免一次撈爆）。
- `brands` 含未知品牌 → 400 `UNKNOWN_BRAND`（白名單 `choice/eeze/lucky`）。
- **比較期 `changePct` 分母為 0**：比較期值為 0 時，回 `changePct: null`，前端顯示 `—` 不顯示箭頭。
- **負值指標方向**：GGR / Margin 為負時，「往 0 靠近 = 改善」。`changePct` 以 `(本期−比較期)/|比較期|` 計算，故 -6078K → -4722K 會得到 +22.3%（變好=綠），與截圖一致。
- 區間內某天無資料 → 該天當 0 計入彙總（不跳點，圖表才連續）。
- 未帶 JWT / 過期 → 401（沿用現有 `requireAuth`）。

## 9. 量測（埋點 / 指標）

- 事件：`dashboard.view`（含選定 brands、區間長度）、`dashboard.tab_switch`、`dashboard.range_change`。
- 監控：兩支 API 的 p95 latency、錯誤率；彙總表「最後寫入時間」距今超過 26 小時 → 告警（資料卡住）。

## 10. 風險與合規

- **效能**：時間序列查詢需走 `(brand, date)` 索引；大區間 + 全品牌時於 DB 端 `GROUP BY date` 彙總，不要把逐筆撈回 Node。
- **金額精度**：一律分為單位存 bigint，回傳前才轉，避免 Margin / ATPPU 浮點漂移。
- **資料來源標示**：本期為 seed 假資料，畫面或 API 需可標注 `source: "seed"`，避免被當真實營運數據解讀。
- **無 PII**：彙總表不含玩家個資（只有計數），降低合規面風險。
```
