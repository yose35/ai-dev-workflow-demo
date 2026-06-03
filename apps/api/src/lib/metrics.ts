// Spec: specs/dashboard-kpi.md §4 指標定義 / §7 API / §8 邊界
// 純函式彙總邏輯 — 與 Fastify / Prisma 解耦，方便單元測試。
// 金額在 DB 以「分(cent)」BigInt 儲存，這裡統一轉「元」回傳。
import { errors } from './errors.js';

export const BRANDS = ['choice', 'eeze', 'lucky'] as const;
export type Brand = (typeof BRANDS)[number];

export const METRIC_KEYS = [
  'wager',
  'validWager',
  'ggr',
  'margin',
  'playerCount',
  'betCount',
  'atppu',
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export type Granularity = 'day' | 'week' | 'month';

const MAX_RANGE_DAYS = 366;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Prisma 撈回的原始列（cents 以 bigint）
export interface MetricRow {
  date: Date;
  brand: string;
  wager: bigint;
  validWager: bigint;
  ggr: bigint;
  payout: bigint;
  playerCount: number;
  betCount: number;
}

// ── 日期 ────────────────────────────────────────────────
export function parseDate(s: string): Date {
  if (!DATE_RE.test(s)) throw errors.invalidDateRange(`日期格式錯誤：${s}（需 YYYY-MM-DD）`);
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw errors.invalidDateRange(`無效日期：${s}`);
  return d;
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 含頭含尾的天數 */
export function daysInclusive(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

/** 驗證並回傳本期區間（throws AppError） */
export function resolvePeriod(fromStr: string, toStr: string): { from: Date; to: Date } {
  const from = parseDate(fromStr);
  const to = parseDate(toStr);
  if (from.getTime() > to.getTime()) throw errors.invalidDateRange();
  if (daysInclusive(from, to) > MAX_RANGE_DAYS) throw errors.rangeTooLarge(MAX_RANGE_DAYS);
  return { from, to };
}

/** 預設 WoW 比較期：往前一個等長區間 */
export function defaultCompare(from: Date, to: Date): { from: Date; to: Date } {
  const len = daysInclusive(from, to);
  const compareTo = new Date(from.getTime() - 86_400_000); // 本期前一天
  const compareFrom = new Date(compareTo.getTime() - (len - 1) * 86_400_000);
  return { from: compareFrom, to: compareTo };
}

// ── 品牌白名單 ──────────────────────────────────────────
export function parseBrands(param?: string): Brand[] {
  if (!param || param.trim() === '') return [...BRANDS];
  const list = param.split(',').map((s) => s.trim().toLowerCase());
  for (const b of list) {
    if (!BRANDS.includes(b as Brand)) throw errors.unknownBrand(b);
  }
  return list as Brand[];
}

// ── 金額換算 ────────────────────────────────────────────
const centsToDollars = (cents: bigint): number => Number(cents) / 100;

// ── 彙總 ────────────────────────────────────────────────
export interface Totals {
  wager: number;
  validWager: number;
  ggr: number;
  payout: number;
  playerCount: number;
  betCount: number;
}

export function sumRows(rows: MetricRow[]): Totals {
  const acc: Totals = {
    wager: 0,
    validWager: 0,
    ggr: 0,
    payout: 0,
    playerCount: 0,
    betCount: 0,
  };
  for (const r of rows) {
    acc.wager += centsToDollars(r.wager);
    acc.validWager += centsToDollars(r.validWager);
    acc.ggr += centsToDollars(r.ggr);
    acc.payout += centsToDollars(r.payout);
    acc.playerCount += r.playerCount;
    acc.betCount += r.betCount;
  }
  return acc;
}

const round = (n: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** 由 Totals 推導 7 個 KPI 的純量值（§4 公式） */
export function deriveMetric(totals: Totals, key: MetricKey): number {
  switch (key) {
    case 'wager':
      return round(totals.wager);
    case 'validWager':
      return round(totals.validWager);
    case 'ggr':
      return round(totals.ggr);
    case 'margin':
      return totals.wager > 0 ? round((totals.ggr / totals.wager) * 100, 2) : 0;
    case 'playerCount':
      return totals.playerCount;
    case 'betCount':
      return totals.betCount;
    case 'atppu':
      return totals.playerCount > 0 ? round(totals.validWager / totals.playerCount, 2) : 0;
  }
}

/** §8：比較期為 0 → null（前端顯示 —）；負值指標用 |compare| 當分母 */
export function changePct(current: number, compare: number): number | null {
  if (compare === 0) return null;
  return round(((current - compare) / Math.abs(compare)) * 100, 1);
}

// ── 時間分桶 ────────────────────────────────────────────
function startOfWeekUtc(d: Date): Date {
  // 以週一為一週起點
  const day = d.getUTCDay(); // 0=Sun
  const diff = (day + 6) % 7; // 距上一個週一的天數
  return new Date(d.getTime() - diff * 86_400_000);
}

export function bucketKey(date: Date, granularity: Granularity): string {
  switch (granularity) {
    case 'day':
      return formatDate(date);
    case 'week':
      return formatDate(startOfWeekUtc(date));
    case 'month':
      return formatDate(date).slice(0, 7); // YYYY-MM
  }
}

export interface Bucket {
  bucket: string;
  totals: Totals;
}

/** 依粒度把 rows 分桶並各自加總，回傳按 bucket 升冪排序的陣列 */
export function aggregateByBucket(rows: MetricRow[], granularity: Granularity): Bucket[] {
  const map = new Map<string, MetricRow[]>();
  for (const r of rows) {
    const k = bucketKey(r.date, granularity);
    const arr = map.get(k);
    if (arr) arr.push(r);
    else map.set(k, [r]);
  }
  return [...map.keys()]
    .sort()
    .map((bucket) => ({ bucket, totals: sumRows(map.get(bucket)!) }));
}

/** 給某個 KPI 的 sparkline：本期逐桶的純量值 */
export function sparkline(rows: MetricRow[], granularity: Granularity, key: MetricKey): number[] {
  return aggregateByBucket(rows, granularity).map((b) => deriveMetric(b.totals, key));
}
