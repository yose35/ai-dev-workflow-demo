// Spec: specs/dashboard-kpi.md §7 — MSW 用的 KPI / timeseries 假資料產生器
// 與後端 seed 同風格（確定性偽隨機 + 同樣的衍生公式），讓 FE 不接 BE 也能跑。
import type {
  KpiResponse,
  TimeseriesResponse,
  TimeseriesPoint,
  MetricKey,
} from "@/lib/api-types";

const BRANDS = ["choice", "eeze", "lucky"] as const;
const METRIC_KEYS: MetricKey[] = [
  "wager",
  "validWager",
  "ggr",
  "margin",
  "playerCount",
  "betCount",
  "atppu",
];
const BRAND_BASE: Record<string, { wager: number; players: number }> = {
  choice: { wager: 1_800_000, players: 150 },
  eeze: { wager: 900_000, players: 80 },
  lucky: { wager: 1_300_000, players: 110 },
};

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DayRow {
  date: Date;
  wager: number;
  validWager: number;
  ggr: number;
  playerCount: number;
  betCount: number;
}

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

// 以「距 epoch 的天數」當 seed → 同一天同品牌結果固定
function genRow(date: Date, brand: string): DayRow {
  const dayIndex = Math.floor(date.getTime() / DAY);
  const rng = mulberry32(
    brand.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 7919 + dayIndex * 31
  );
  const base = BRAND_BASE[brand]!;
  const dow = date.getUTCDay();
  const weekend = dow === 0 || dow === 5 || dow === 6 ? 1.25 : 1.0;
  const noise = 0.7 + rng() * 0.7;
  const wager = base.wager * weekend * noise;
  const validWager = wager * (0.5 + rng() * 0.15);
  const ggr = wager * (-0.7 + rng() * 0.78);
  const playerCount = Math.round(base.players * weekend * (0.7 + rng() * 0.7));
  const betCount = Math.round(playerCount * (80 + rng() * 50));
  return { date, wager, validWager, ggr, playerCount, betCount };
}

interface Totals {
  wager: number;
  validWager: number;
  ggr: number;
  playerCount: number;
  betCount: number;
}
const emptyTotals = (): Totals => ({
  wager: 0,
  validWager: 0,
  ggr: 0,
  playerCount: 0,
  betCount: 0,
});

function eachDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) out.push(new Date(t));
  return out;
}

function bucketKey(date: Date, g: string): string {
  if (g === "month") return ymd(date).slice(0, 7);
  if (g === "week") {
    const day = date.getUTCDay();
    const diff = (day + 6) % 7;
    return ymd(new Date(date.getTime() - diff * DAY));
  }
  return ymd(date);
}

function rowsFor(from: Date, to: Date, brands: string[]): DayRow[] {
  const rows: DayRow[] = [];
  for (const d of eachDay(from, to)) {
    for (const brand of brands) rows.push(genRow(d, brand));
  }
  return rows;
}

function sum(rows: DayRow[]): Totals {
  return rows.reduce((acc, r) => {
    acc.wager += r.wager;
    acc.validWager += r.validWager;
    acc.ggr += r.ggr;
    acc.playerCount += r.playerCount;
    acc.betCount += r.betCount;
    return acc;
  }, emptyTotals());
}

const r2 = (n: number) => Math.round(n * 100) / 100;
function derive(t: Totals, key: MetricKey): number {
  switch (key) {
    case "wager":
      return r2(t.wager);
    case "validWager":
      return r2(t.validWager);
    case "ggr":
      return r2(t.ggr);
    case "margin":
      return t.wager > 0 ? r2((t.ggr / t.wager) * 100) : 0;
    case "playerCount":
      return t.playerCount;
    case "betCount":
      return t.betCount;
    case "atppu":
      return t.playerCount > 0 ? r2(t.validWager / t.playerCount) : 0;
  }
}
function changePct(cur: number, comp: number): number | null {
  if (comp === 0) return null;
  return Math.round(((cur - comp) / Math.abs(comp)) * 1000) / 10;
}

function parseBrands(param: string | null): string[] {
  if (!param) return [...BRANDS];
  return param.split(",").map((s) => s.trim());
}

function bucketize(rows: DayRow[], g: string): { bucket: string; totals: Totals }[] {
  const map = new Map<string, DayRow[]>();
  for (const r of rows) {
    const k = bucketKey(r.date, g);
    (map.get(k) ?? map.set(k, []).get(k)!).push(r);
  }
  return [...map.keys()].sort().map((bucket) => ({ bucket, totals: sum(map.get(bucket)!) }));
}

// ── 給 handlers 呼叫 ────────────────────────────────────
export function kpiData(url: URL): KpiResponse["data"] {
  const from = new Date(`${url.searchParams.get("from")}T00:00:00.000Z`);
  const to = new Date(`${url.searchParams.get("to")}T00:00:00.000Z`);
  const g = url.searchParams.get("granularity") ?? "day";
  const brands = parseBrands(url.searchParams.get("brands"));

  const len = Math.round((to.getTime() - from.getTime()) / DAY) + 1;
  const compareTo = new Date(from.getTime() - DAY);
  const compareFrom = new Date(compareTo.getTime() - (len - 1) * DAY);

  const periodRows = rowsFor(from, to, brands);
  const compareRows = rowsFor(compareFrom, compareTo, brands);
  const pt = sum(periodRows);
  const ct = sum(compareRows);
  const buckets = bucketize(periodRows, g);

  const kpis = {} as KpiResponse["data"]["kpis"];
  for (const key of METRIC_KEYS) {
    const value = derive(pt, key);
    const compare = derive(ct, key);
    kpis[key] = {
      value,
      compare,
      changePct: changePct(value, compare),
      spark: buckets.map((b) => derive(b.totals, key)),
    };
  }

  return {
    source: "seed",
    granularity: g as "day" | "week" | "month",
    period: { from: ymd(from), to: ymd(to) },
    compare: { from: ymd(compareFrom), to: ymd(compareTo) },
    kpis,
  };
}

export function timeseriesData(url: URL): TimeseriesResponse["data"] {
  const from = new Date(`${url.searchParams.get("from")}T00:00:00.000Z`);
  const to = new Date(`${url.searchParams.get("to")}T00:00:00.000Z`);
  const g = url.searchParams.get("granularity") ?? "day";
  const brands = parseBrands(url.searchParams.get("brands"));
  const metricsParam = url.searchParams.get("metrics");
  const requested: MetricKey[] = metricsParam
    ? (metricsParam.split(",").map((s) => s.trim()).filter((s) =>
        METRIC_KEYS.includes(s as MetricKey)
      ) as MetricKey[])
    : [...METRIC_KEYS];

  const buckets = bucketize(rowsFor(from, to, brands), g);
  const points: TimeseriesPoint[] = buckets.map((b) => {
    const point: TimeseriesPoint = { bucket: b.bucket };
    for (const key of requested) point[key] = derive(b.totals, key);
    return point;
  });

  return {
    source: "seed",
    granularity: g as "day" | "week" | "month",
    period: { from: ymd(from), to: ymd(to) },
    metrics: requested,
    points,
  };
}
