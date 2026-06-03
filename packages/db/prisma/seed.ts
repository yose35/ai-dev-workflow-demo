// Spec: specs/dashboard-kpi.md — 產生 dashboard 示範用假資料
// 確定性偽隨機（seeded PRNG）→ 每次跑結果一致，方便 demo 與測試對齊。
// 金額以「分(cent)」存 BigInt：dollars * 100。
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BRANDS = ['choice', 'eeze', 'lucky'] as const;
const DAYS = 60; // 產生最近 60 天

// ── 確定性 PRNG（mulberry32）──────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 各品牌的規模基準（每日 wager 中位數，美元）
const BRAND_BASE: Record<(typeof BRANDS)[number], { wager: number; players: number }> = {
  choice: { wager: 1_800_000, players: 150 },
  eeze: { wager: 900_000, players: 80 },
  lucky: { wager: 1_300_000, players: 110 },
};

function toCents(dollars: number): bigint {
  return BigInt(Math.round(dollars * 100));
}

function startDateUtc(daysAgo: number): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

async function main() {
  console.log('🌱 Seeding daily_brand_metrics (確定性假資料)...');

  const rows: {
    date: Date;
    brand: string;
    wager: bigint;
    validWager: bigint;
    ggr: bigint;
    payout: bigint;
    playerCount: number;
    betCount: number;
  }[] = [];

  for (const brand of BRANDS) {
    const base = BRAND_BASE[brand];
    for (let i = DAYS - 1; i >= 0; i--) {
      const date = startDateUtc(i);
      // 以 (品牌, 第幾天) 當 seed → 確定性
      const rng = mulberry32(
        brand.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 7919 + i * 31
      );

      const dow = date.getUTCDay(); // 0=Sun
      // 週末投注量較高（seasonality），加上日噪音
      const weekend = dow === 0 || dow === 5 || dow === 6 ? 1.25 : 1.0;
      const noise = 0.7 + rng() * 0.7; // 0.7 ~ 1.4
      const wagerUsd = base.wager * weekend * noise;

      // 有效投注 ≈ 50%~65% 的 wager
      const validUsd = wagerUsd * (0.5 + rng() * 0.15);

      // Margin 在 -70% ~ +8% 間擺盪（demo 刻意偏負，貼近截圖的負 GGR/Margin）
      const marginFrac = -0.7 + rng() * 0.78;
      const ggrUsd = wagerUsd * marginFrac;
      const payoutUsd = wagerUsd - ggrUsd;

      const playerCount = Math.round(base.players * weekend * (0.7 + rng() * 0.7));
      // 每位玩家平均 80~130 筆投注
      const betCount = Math.round(playerCount * (80 + rng() * 50));

      rows.push({
        date,
        brand,
        wager: toCents(wagerUsd),
        validWager: toCents(validUsd),
        ggr: toCents(ggrUsd),
        payout: toCents(payoutUsd),
        playerCount,
        betCount,
      });
    }
  }

  // 冪等：先清空再寫入（demo 用，正式 ETL 會 upsert）
  await prisma.dailyBrandMetric.deleteMany({});
  await prisma.dailyBrandMetric.createMany({ data: rows });

  console.log(`✅ Seeded ${rows.length} rows（${BRANDS.length} 品牌 × ${DAYS} 天）`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
