// Spec: specs/dashboard-kpi.md §7 API — 路由整合測試（mock prisma + 真 JWT）
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { signAccessToken } from '../../lib/jwt.js';

// ── in-memory daily_brand_metrics mock ──────────────────
interface Rec {
  date: Date;
  brand: string;
  wager: bigint;
  validWager: bigint;
  ggr: bigint;
  payout: bigint;
  playerCount: number;
  betCount: number;
}
const store: Rec[] = [];

const prismaMock = {
  dailyBrandMetric: {
    findMany: vi.fn(({ where }: any) => {
      const gte = where?.date?.gte as Date | undefined;
      const lte = where?.date?.lte as Date | undefined;
      const brands = where?.brand?.in as string[] | undefined;
      const out = store.filter((r) => {
        if (gte && r.date.getTime() < gte.getTime()) return false;
        if (lte && r.date.getTime() > lte.getTime()) return false;
        if (brands && !brands.includes(r.brand)) return false;
        return true;
      });
      return Promise.resolve(out);
    }),
  },
};
vi.mock('@pkg/db', () => ({ prisma: prismaMock }));

const { metricsRoutes } = await import('./metrics.js');
const { registerErrorHandler } = await import('../../plugins/errorHandler.js');

const FAKE_ENV = {
  NODE_ENV: 'test' as const,
  PORT: 3000,
  DATABASE_URL: 'postgres://test',
  JWT_SECRET: 'x'.repeat(32),
  JWT_ACCESS_TTL_SEC: 900,
  JWT_REFRESH_TTL_SEC: 2592000,
};

function rec(date: string, brand: string, p: Record<string, number>): Rec {
  return {
    date: new Date(`${date}T00:00:00.000Z`),
    brand,
    wager: BigInt(Math.round((p.wager ?? 0) * 100)),
    validWager: BigInt(Math.round((p.validWager ?? 0) * 100)),
    ggr: BigInt(Math.round((p.ggr ?? 0) * 100)),
    payout: BigInt(Math.round((p.payout ?? 0) * 100)),
    playerCount: p.playerCount ?? 0,
    betCount: p.betCount ?? 0,
  };
}

async function makeApp() {
  const app = Fastify();
  registerErrorHandler(app);
  metricsRoutes(app, FAKE_ENV as any);
  await app.ready();
  return app;
}

async function authHeader() {
  const { token } = await signAccessToken(
    { sub: 'user_1', email: 'a@b.com' },
    FAKE_ENV.JWT_SECRET,
    900
  );
  return { authorization: `Bearer ${token}` };
}

beforeEach(() => {
  store.length = 0;
  // 本期 2026-05-27..28（choice），比較期 2026-05-25..26
  store.push(rec('2026-05-27', 'choice', { wager: 1000, validWager: 600, ggr: -300, playerCount: 10, betCount: 1000 }));
  store.push(rec('2026-05-28', 'choice', { wager: 2000, validWager: 1000, ggr: -100, playerCount: 20, betCount: 2000 }));
  store.push(rec('2026-05-25', 'choice', { wager: 1500, validWager: 800, ggr: -500, playerCount: 15, betCount: 1500 }));
  store.push(rec('2026-05-26', 'choice', { wager: 1500, validWager: 700, ggr: -500, playerCount: 15, betCount: 1500 }));
  store.push(rec('2026-05-27', 'eeze', { wager: 9999, validWager: 9999, ggr: 9999, playerCount: 99, betCount: 9999 }));
});

describe('GET /metrics/kpi', () => {
  it('未帶 JWT → 401', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/metrics/kpi?from=2026-05-27&to=2026-05-28' });
    expect(res.statusCode).toBe(401);
  });

  it('回 7 個 KPI、本期/比較期值與 WoW 自動比較期', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/metrics/kpi?from=2026-05-27&to=2026-05-28&brands=choice',
      headers: await authHeader(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    // 自動 WoW 比較期應為前兩天 25..26
    expect(body.data.compare).toEqual({ from: '2026-05-25', to: '2026-05-26' });
    expect(Object.keys(body.data.kpis)).toHaveLength(7);
    // wager 本期 = 1000+2000 = 3000
    expect(body.data.kpis.wager.value).toBe(3000);
    // 比較期 wager = 1500+1500 = 3000 → changePct 0
    expect(body.data.kpis.wager.compare).toBe(3000);
    expect(body.data.kpis.wager.changePct).toBe(0);
    // sparkline 兩個桶（27、28）
    expect(body.data.kpis.wager.spark).toEqual([1000, 2000]);
    // margin = -400/3000*100
    expect(body.data.kpis.margin.value).toBeCloseTo(-13.33, 1);
    // source 標示為 seed
    expect(body.data.source).toBe('seed');
  });

  it('brands 篩選有效（eeze 的大數不混入 choice）', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/metrics/kpi?from=2026-05-27&to=2026-05-28&brands=choice',
      headers: await authHeader(),
    });
    expect(res.json().data.kpis.wager.value).toBe(3000); // 不含 eeze 的 9999
  });

  it('from > to → 400 INVALID_DATE_RANGE', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/metrics/kpi?from=2026-05-28&to=2026-05-27',
      headers: await authHeader(),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_DATE_RANGE');
  });

  it('未知品牌 → 400 UNKNOWN_BRAND', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/metrics/kpi?from=2026-05-27&to=2026-05-28&brands=evil',
      headers: await authHeader(),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('UNKNOWN_BRAND');
  });
});

describe('GET /metrics/timeseries', () => {
  it('回逐桶 points，含指定 metrics', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/metrics/timeseries?from=2026-05-27&to=2026-05-28&brands=choice&metrics=wager,margin',
      headers: await authHeader(),
    });
    expect(res.statusCode).toBe(200);
    const { points, metrics } = res.json().data;
    expect(metrics).toEqual(['wager', 'margin']);
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ bucket: '2026-05-27', wager: 1000 });
    expect(points[1]).toMatchObject({ bucket: '2026-05-28', wager: 2000 });
  });

  it('granularity=week 合併成單一桶', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/metrics/timeseries?from=2026-05-27&to=2026-05-28&brands=choice&granularity=week&metrics=wager',
      headers: await authHeader(),
    });
    const { points } = res.json().data;
    expect(points).toHaveLength(1); // 27、28 同一週
    expect(points[0].wager).toBe(3000);
  });
});
