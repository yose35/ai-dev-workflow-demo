// Spec: specs/dashboard-kpi.md §4 指標定義 / §8 邊界 — 純函式單元測試
import { describe, it, expect } from 'vitest';
import {
  parseDate,
  formatDate,
  daysInclusive,
  resolvePeriod,
  defaultCompare,
  parseBrands,
  sumRows,
  deriveMetric,
  changePct,
  bucketKey,
  aggregateByBucket,
  sparkline,
  type MetricRow,
} from './metrics.js';
import { AppError } from './errors.js';

// helper：建一列（金額傳「元」，自動轉成 cents bigint）
function row(date: string, brand: string, p: Partial<Record<string, number>> = {}): MetricRow {
  const d = {
    wager: p.wager ?? 0,
    validWager: p.validWager ?? 0,
    ggr: p.ggr ?? 0,
    payout: p.payout ?? 0,
    playerCount: p.playerCount ?? 0,
    betCount: p.betCount ?? 0,
  };
  return {
    date: new Date(`${date}T00:00:00.000Z`),
    brand,
    wager: BigInt(Math.round(d.wager * 100)),
    validWager: BigInt(Math.round(d.validWager * 100)),
    ggr: BigInt(Math.round(d.ggr * 100)),
    payout: BigInt(Math.round(d.payout * 100)),
    playerCount: d.playerCount,
    betCount: d.betCount,
  };
}

describe('日期', () => {
  it('parseDate 接受 YYYY-MM-DD', () => {
    expect(formatDate(parseDate('2026-05-27'))).toBe('2026-05-27');
  });

  it('parseDate 拒絕壞格式', () => {
    expect(() => parseDate('2026/05/27')).toThrow(AppError);
    expect(() => parseDate('not-a-date')).toThrow(AppError);
  });

  it('daysInclusive 含頭含尾', () => {
    expect(daysInclusive(parseDate('2026-05-27'), parseDate('2026-06-02'))).toBe(7);
    expect(daysInclusive(parseDate('2026-05-27'), parseDate('2026-05-27'))).toBe(1);
  });

  it('resolvePeriod：from > to → INVALID_DATE_RANGE', () => {
    expect(() => resolvePeriod('2026-06-02', '2026-05-27')).toThrow(/from/);
  });

  it('resolvePeriod：超過 366 天 → RANGE_TOO_LARGE', () => {
    let code = '';
    try {
      resolvePeriod('2024-01-01', '2026-01-01');
    } catch (e) {
      code = (e as AppError).code;
    }
    expect(code).toBe('RANGE_TOO_LARGE');
  });

  it('defaultCompare 是往前一個等長區間（WoW）', () => {
    const c = defaultCompare(parseDate('2026-05-27'), parseDate('2026-06-02'));
    expect(formatDate(c.from)).toBe('2026-05-20');
    expect(formatDate(c.to)).toBe('2026-05-26');
  });
});

describe('品牌白名單', () => {
  it('未帶 → 全部', () => {
    expect(parseBrands()).toEqual(['choice', 'eeze', 'lucky']);
  });
  it('指定多個', () => {
    expect(parseBrands('choice,lucky')).toEqual(['choice', 'lucky']);
  });
  it('未知品牌 → UNKNOWN_BRAND', () => {
    let code = '';
    try {
      parseBrands('choice,evil');
    } catch (e) {
      code = (e as AppError).code;
    }
    expect(code).toBe('UNKNOWN_BRAND');
  });
});

describe('彙總與衍生指標', () => {
  const rows = [
    row('2026-05-27', 'choice', {
      wager: 1000,
      validWager: 600,
      ggr: -300,
      playerCount: 10,
      betCount: 1000,
    }),
    row('2026-05-27', 'eeze', {
      wager: 1000,
      validWager: 400,
      ggr: 100,
      playerCount: 10,
      betCount: 500,
    }),
  ];

  it('sumRows 跨品牌加總（cents → dollars）', () => {
    const t = sumRows(rows);
    expect(t.wager).toBe(2000);
    expect(t.validWager).toBe(1000);
    expect(t.ggr).toBe(-200);
    expect(t.playerCount).toBe(20);
    expect(t.betCount).toBe(1500);
  });

  it('margin = ggr/wager*100，可為負', () => {
    const t = sumRows(rows);
    expect(deriveMetric(t, 'margin')).toBe(-10); // -200/2000
  });

  it('atppu = validWager/playerCount', () => {
    const t = sumRows(rows);
    expect(deriveMetric(t, 'atppu')).toBe(50); // 1000/20
  });

  it('wager=0 時 margin 不除零（回 0）', () => {
    const t = sumRows([row('2026-05-27', 'choice', { playerCount: 0 })]);
    expect(deriveMetric(t, 'margin')).toBe(0);
    expect(deriveMetric(t, 'atppu')).toBe(0);
  });
});

describe('changePct（§8）', () => {
  it('一般情況', () => {
    expect(changePct(149.8, 100)).toBeCloseTo(49.8, 1);
  });
  it('比較期為 0 → null', () => {
    expect(changePct(100, 0)).toBeNull();
  });
  it('負值指標往 0 靠近 = 正成長（截圖 GGR -6078K→-4722K ≈ +22.3%）', () => {
    expect(changePct(-4722, -6078)).toBeCloseTo(22.3, 1);
  });
});

describe('時間分桶', () => {
  it('week 桶以週一為起點', () => {
    // 2026-05-27 是週三 → 同週週一 2026-05-25
    expect(bucketKey(parseDate('2026-05-27'), 'week')).toBe('2026-05-25');
  });
  it('month 桶 YYYY-MM', () => {
    expect(bucketKey(parseDate('2026-05-27'), 'month')).toBe('2026-05');
  });

  it('aggregateByBucket 依日分桶且升冪', () => {
    const rows = [
      row('2026-05-28', 'choice', { wager: 100 }),
      row('2026-05-27', 'choice', { wager: 200 }),
      row('2026-05-27', 'eeze', { wager: 50 }),
    ];
    const buckets = aggregateByBucket(rows, 'day');
    expect(buckets.map((b) => b.bucket)).toEqual(['2026-05-27', '2026-05-28']);
    expect(buckets[0]!.totals.wager).toBe(250);
  });

  it('sparkline 回逐桶純量', () => {
    const rows = [
      row('2026-05-27', 'choice', { wager: 200 }),
      row('2026-05-28', 'choice', { wager: 100 }),
    ];
    expect(sparkline(rows, 'day', 'wager')).toEqual([200, 100]);
  });
});
