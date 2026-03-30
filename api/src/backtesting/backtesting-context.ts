import { MarketCycleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { rowsToSeries, type PriceSeries } from './price-series.util';
import type { StrategyContext } from './strategy-allocations';

export const MIN_POINTS = 25;

function toUtcDate(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export function weekIndexFromStart(startMs: number, eventMs: number): number {
  const dt = eventMs - startMs;
  return Math.max(0, Math.floor(dt / (7 * 86400000)));
}

export async function buildStrategyContext(
  prisma: PrismaService,
  startDate: Date,
  endDate: Date,
): Promise<StrategyContext> {
  const start = toUtcDate(startDate);
  const end = toUtcDate(endDate);
  const pad = new Date(start);
  pad.setUTCDate(pad.getUTCDate() - 120);

  const rows = await prisma.priceHistory.findMany({
    where: { date: { gte: pad, lte: end } },
    orderBy: [{ carId: 'asc' }, { date: 'asc' }],
  });

  const byCar = new Map<string, Array<{ date: Date; price: unknown }>>();
  for (const r of rows) {
    const arr = byCar.get(r.carId) ?? [];
    arr.push({ date: r.date, price: r.price });
    byCar.set(r.carId, arr);
  }

  const series = new Map<string, PriceSeries>();
  const startMs = start.getTime();
  const endMs = end.getTime();
  for (const [carId, arr] of byCar) {
    const s = rowsToSeries(arr);
    if (s.t.length < MIN_POINTS) continue;
    if (s.t[0] > startMs || s.t[s.t.length - 1] < endMs) continue;
    series.set(carId, s);
  }

  const universe = Array.from(series.keys());
  if (universe.length < 3) {
    throw new Error('INSUFFICIENT_DATA');
  }

  const dateSet = new Set<number>();
  for (const s of series.values()) {
    for (let i = 0; i < s.t.length; i++) {
      const ts = s.t[i];
      if (ts >= startMs && ts <= endMs) dateSet.add(ts);
    }
  }
  const globalDates = Array.from(dateSet).sort((a, b) => a - b);
  if (globalDates.length < 10) {
    throw new Error('INSUFFICIENT_DAYS');
  }

  const carsMeta = await prisma.car.findMany({
    where: { id: { in: universe } },
    select: {
      id: true,
      segment: true,
      scores: {
        select: { investmentScore: true, riskScore: true },
      },
    },
  });

  const carSegment = new Map<string, string | null>();
  const inv: Array<{ id: string; v: number }> = [];
  const risk: Array<{ id: string; v: number }> = [];
  for (const c of carsMeta) {
    carSegment.set(c.id, c.segment ?? null);
    inv.push({ id: c.id, v: c.scores?.investmentScore ?? -1 });
    risk.push({
      id: c.id,
      v: c.scores?.riskScore ?? 1e9,
    });
  }
  inv.sort((a, b) => b.v - a.v);
  risk.sort((a, b) => a.v - b.v);
  const investmentRank = inv.map((x) => x.id);
  const lowRiskRank = risk.map((x) => x.id);

  const segRows = await prisma.segmentMarketIndex.findMany({
    where: { snapshotDate: { gte: start, lte: end } },
    orderBy: [{ segment: 'asc' }, { snapshotDate: 'asc' }],
  });
  const segBySeg = new Map<string, Array<{ d: number; v: number }>>();
  for (const r of segRows) {
    const k = r.segment;
    const arr = segBySeg.get(k) ?? [];
    arr.push({ d: r.snapshotDate.getTime(), v: r.indexValue });
    segBySeg.set(k, arr);
  }
  const segmentMomentum = new Map<string, number>();
  for (const [seg, arr] of segBySeg) {
    if (arr.length < 2) continue;
    const a = arr[arr.length - 1];
    const b = arr[Math.max(0, arr.length - 6)];
    segmentMomentum.set(seg, a.v - b.v);
  }

  const cycles = await prisma.marketCycle.findMany({
    where: { snapshotDate: { gte: start, lte: end } },
    orderBy: [{ segment: 'asc' }, { snapshotDate: 'desc' }],
  });
  const bullSegments = new Set<string>();
  const seen = new Set<string>();
  for (const c of cycles) {
    if (seen.has(c.segment)) continue;
    seen.add(c.segment);
    if (c.cycleType === MarketCycleType.BULL) bullSegments.add(c.segment);
  }

  const sessions = await prisma.recommendationSession.findMany({
    where: { createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: 'asc' },
    include: {
      results: { orderBy: { rank: 'asc' } },
    },
  });

  const weekPicksTop1 = new Map<number, string | undefined>();
  const weekPicksTop3 = new Map<number, string[] | undefined>();
  const usedWeek = new Set<number>();
  for (const sess of sessions) {
    const wk = weekIndexFromStart(startMs, sess.createdAt.getTime());
    if (usedWeek.has(wk)) continue;
    usedWeek.add(wk);
    const sorted = [...sess.results].sort((a, b) => a.rank - b.rank);
    if (sorted[0]) weekPicksTop1.set(wk, sorted[0].carId);
    weekPicksTop3.set(
      wk,
      sorted.slice(0, 3).map((r) => r.carId),
    );
  }

  return {
    universe,
    series,
    globalDates,
    carSegment,
    investmentRank,
    lowRiskRank,
    segmentMomentum,
    bullSegments,
    weekPicksTop1,
    weekPicksTop3,
  };
}
