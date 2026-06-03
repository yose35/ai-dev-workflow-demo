-- 對應 Spec: specs/dashboard-kpi.md 第 6 節
-- 每日 × 品牌 KPI 彙總表。金額以「分(cent)」存 BIGINT，避免浮點誤差。
-- down 腳本見同目錄 down.sql（CLAUDE.md 鐵則 #6：可逆 migration）

CREATE TABLE "daily_brand_metrics" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "date"         DATE NOT NULL,
  "brand"        TEXT NOT NULL,
  "wager"        BIGINT NOT NULL,
  "valid_wager"  BIGINT NOT NULL,
  "ggr"          BIGINT NOT NULL,
  "payout"       BIGINT NOT NULL,
  "player_count" INTEGER NOT NULL,
  "bet_count"    INTEGER NOT NULL,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 同一天同品牌只能有一筆（ETL upsert 用）
CREATE UNIQUE INDEX "uq_metric_date_brand" ON "daily_brand_metrics" ("date", "brand");

-- 時間序列查詢主要走 (brand, date)
CREATE INDEX "idx_metric_brand_date" ON "daily_brand_metrics" ("brand", "date");
