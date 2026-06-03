// Spec: specs/dashboard-kpi.md §7 — GET /metrics/kpi + GET /metrics/timeseries
// OpenAPI: packages/contract/openapi.yaml（Metrics tag）
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@pkg/db';
import { requireAuth } from '../../lib/auth.js';
import {
  resolvePeriod,
  defaultCompare,
  parseBrands,
  parseDate,
  formatDate,
  sumRows,
  deriveMetric,
  changePct,
  sparkline,
  aggregateByBucket,
  METRIC_KEYS,
  type Granularity,
  type MetricKey,
  type MetricRow,
} from '../../lib/metrics.js';
import type { Env } from '../../config/env.js';

const GranularitySchema = z.enum(['day', 'week', 'month']).default('day');

const KpiQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
  compareFrom: z.string().optional(),
  compareTo: z.string().optional(),
  brands: z.string().optional(),
  granularity: GranularitySchema,
});

const TimeseriesQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
  brands: z.string().optional(),
  granularity: GranularitySchema,
  metrics: z.string().optional(),
});

// demo 資料來源標示（§10）：本期為 seed 假資料
const SOURCE = 'seed';

async function fetchRows(
  from: Date,
  to: Date,
  brands: string[]
): Promise<MetricRow[]> {
  // demo 規模（~180 列）於 JS 端彙總即可；正式環境應把 GROUP BY 下推 DB（見 spec §10）
  return prisma.dailyBrandMetric.findMany({
    where: { date: { gte: from, lte: to }, brand: { in: brands } },
    orderBy: { date: 'asc' },
  }) as unknown as Promise<MetricRow[]>;
}

export function metricsRoutes(app: FastifyInstance, env: Env) {
  // ── GET /metrics/kpi ──────────────────────────────────
  app.get('/metrics/kpi', async (req, reply) => {
    await requireAuth(req, env.JWT_SECRET);
    const q = KpiQuerySchema.parse(req.query);

    const period = resolvePeriod(q.from, q.to);
    const compare =
      q.compareFrom && q.compareTo
        ? resolvePeriod(q.compareFrom, q.compareTo)
        : defaultCompare(period.from, period.to);
    const brands = parseBrands(q.brands);
    const granularity = q.granularity as Granularity;

    const [periodRows, compareRows] = await Promise.all([
      fetchRows(period.from, period.to, brands),
      fetchRows(compare.from, compare.to, brands),
    ]);

    const periodTotals = sumRows(periodRows);
    const compareTotals = sumRows(compareRows);

    const kpis: Record<MetricKey, unknown> = {} as Record<MetricKey, unknown>;
    for (const key of METRIC_KEYS) {
      const value = deriveMetric(periodTotals, key);
      const compareValue = deriveMetric(compareTotals, key);
      kpis[key] = {
        value,
        compare: compareValue,
        changePct: changePct(value, compareValue),
        spark: sparkline(periodRows, granularity, key),
      };
    }

    return reply.send({
      ok: true,
      data: {
        source: SOURCE,
        granularity,
        period: { from: formatDate(period.from), to: formatDate(period.to) },
        compare: { from: formatDate(compare.from), to: formatDate(compare.to) },
        kpis,
      },
    });
  });

  // ── GET /metrics/timeseries ───────────────────────────
  app.get('/metrics/timeseries', async (req, reply) => {
    await requireAuth(req, env.JWT_SECRET);
    const q = TimeseriesQuerySchema.parse(req.query);

    const period = resolvePeriod(q.from, q.to);
    const brands = parseBrands(q.brands);
    const granularity = q.granularity as Granularity;

    // 預設回全部指標；可用 metrics= 篩選
    const requested: MetricKey[] = q.metrics
      ? (q.metrics
          .split(',')
          .map((s) => s.trim())
          .filter((s) => (METRIC_KEYS as readonly string[]).includes(s)) as MetricKey[])
      : [...METRIC_KEYS];

    const rows = await fetchRows(period.from, period.to, brands);
    const buckets = aggregateByBucket(rows, granularity);

    const points = buckets.map((b) => {
      const point: Record<string, string | number> = { bucket: b.bucket };
      for (const key of requested) point[key] = deriveMetric(b.totals, key);
      return point;
    });

    return reply.send({
      ok: true,
      data: {
        source: SOURCE,
        granularity,
        period: { from: formatDate(period.from), to: formatDate(period.to) },
        metrics: requested,
        points,
      },
    });
  });
}

// 給其他模組（如測試）需要時可重用
export { parseDate };
