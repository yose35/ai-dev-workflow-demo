-- Down migration for 20260603_dashboard_metrics（CLAUDE.md 鐵則 #6）
-- 還原方式：psql "$DATABASE_URL" -f down.sql

DROP INDEX IF EXISTS "idx_metric_brand_date";
DROP INDEX IF EXISTS "uq_metric_date_brand";
DROP TABLE IF EXISTS "daily_brand_metrics";
