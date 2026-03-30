import { Prisma } from '@prisma/client';
import { stdev } from '../common/stats.util';
import type { PrismaService } from '../prisma/prisma.service';

const MIN_RETURNS = 5;

function volFromPrices(
  prices: number[],
): { volatilityRaw: number | null; volatilityScore: number | null } {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const p0 = prices[i - 1];
    const p1 = prices[i];
    if (p0 > 0 && Number.isFinite(p1)) returns.push((p1 - p0) / p0);
  }
  if (returns.length < MIN_RETURNS) {
    return { volatilityRaw: null, volatilityScore: null };
  }
  const volatilityRaw = stdev(returns);
  const volatilityScore = Math.max(
    0,
    Math.min(100, 100 - volatilityRaw * 1000),
  );
  return {
    volatilityRaw: Math.round(volatilityRaw * 1_000_000) / 1_000_000,
    volatilityScore: Math.round(volatilityScore * 10) / 10,
  };
}

async function priceNearDate(
  prisma: PrismaService,
  carId: string,
  before: Date,
): Promise<number | null> {
  const row = await prisma.priceHistory.findFirst({
    where: { carId, date: { lte: before } },
    orderBy: { date: 'desc' },
    select: { price: true },
  });
  return row?.price.toNumber() ?? null;
}

function normChange(r: number | null): number {
  if (r == null || !Number.isFinite(r)) return 50;
  return Math.max(0, Math.min(100, 50 + r * 400));
}

export type ListingCountWindows = {
  n7: number;
  nPrev7: number;
  n30: number;
  nPrev30: number;
};

/** فیلدهای پویای CarMarketData از تاریخچهٔ قیمت + حجم آگهی */
export async function computeDynamicMarketFields(
  prisma: PrismaService,
  carId: string,
  counts: ListingCountWindows,
): Promise<{
  priceChange7d: Prisma.Decimal | null;
  priceChange30d: Prisma.Decimal | null;
  priceChange90d: Prisma.Decimal | null;
  momentumScore: number | null;
  listingsLast7d: number;
  listingsPrev7d: number;
  listingsLast30d: number;
  listingsPrev30d: number;
  liquidityTrendScore: number | null;
  liquidityTrendLabel: string | null;
  volatilityTrendScore: number | null;
  volatilityTrendLabel: string | null;
}> {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400000);
  const d30 = new Date(now.getTime() - 30 * 86400000);
  const d60 = new Date(now.getTime() - 60 * 86400000);
  const d90 = new Date(now.getTime() - 90 * 86400000);

  const latestRow = await prisma.priceHistory.findFirst({
    where: { carId },
    orderBy: { date: 'desc' },
    select: { price: true },
  });
  const pN = latestRow?.price.toNumber() ?? null;
  const [p7, p30, p90] = await Promise.all([
    priceNearDate(prisma, carId, d7),
    priceNearDate(prisma, carId, d30),
    priceNearDate(prisma, carId, d90),
  ]);

  const rel = (a: number | null, b: number | null) =>
    a != null && b != null && b > 0 ? (a - b) / b : null;

  const change7d = rel(pN, p7);
  const change30d = rel(pN, p30);
  const change90d = rel(pN, p90);

  const hasPh = change7d != null || change30d != null || change90d != null;
  const momentumScore = hasPh
    ? Math.round(
        (0.5 * normChange(change7d) +
          0.3 * normChange(change30d) +
          0.2 * normChange(change90d)) *
          10,
      ) / 10
    : null;

  const r7 =
    counts.nPrev7 > 0
      ? counts.n7 / counts.nPrev7
      : counts.n7 > 0
        ? 1.15
        : 1;
  const r30 =
    counts.nPrev30 > 0
      ? counts.n30 / counts.nPrev30
      : counts.n30 > 0
        ? 1.1
        : 1;

  const liquidityTrendScore =
    Math.round(
      Math.max(0, Math.min(100, 50 + 32 * (r7 - 1) + 28 * (r30 - 1))) * 10,
    ) / 10;
  let liquidityTrendLabel: string;
  if (r7 > 1.08 && r30 > 1.04) liquidityTrendLabel = 'RISING';
  else if (r7 < 0.92 && r30 < 0.96) liquidityTrendLabel = 'FALLING';
  else liquidityTrendLabel = 'STABLE';

  const [hRecent, hPrev] = await Promise.all([
    prisma.priceHistory.findMany({
      where: { carId, date: { gte: d30 } },
      orderBy: { date: 'asc' },
      select: { price: true },
    }),
    prisma.priceHistory.findMany({
      where: { carId, date: { gte: d60, lt: d30 } },
      orderBy: { date: 'asc' },
      select: { price: true },
    }),
  ]);

  const vR = volFromPrices(hRecent.map((h) => h.price.toNumber()));
  const vP = volFromPrices(hPrev.map((h) => h.price.toNumber()));

  let volatilityTrendScore: number | null = null;
  let volatilityTrendLabel: string | null = null;
  if (vR.volatilityScore != null && vP.volatilityScore != null) {
    const diff = vR.volatilityScore - vP.volatilityScore;
    volatilityTrendScore =
      Math.round(Math.max(0, Math.min(100, 50 + diff)) * 10) / 10;
    if (diff > 4) volatilityTrendLabel = 'RISING';
    else if (diff < -4) volatilityTrendLabel = 'FALLING';
    else volatilityTrendLabel = 'STABLE';
  }

  return {
    priceChange7d: change7d != null ? new Prisma.Decimal(change7d) : null,
    priceChange30d: change30d != null ? new Prisma.Decimal(change30d) : null,
    priceChange90d: change90d != null ? new Prisma.Decimal(change90d) : null,
    momentumScore,
    listingsLast7d: counts.n7,
    listingsPrev7d: counts.nPrev7,
    listingsLast30d: counts.n30,
    listingsPrev30d: counts.nPrev30,
    liquidityTrendScore,
    liquidityTrendLabel,
    volatilityTrendScore,
    volatilityTrendLabel,
  };
}
