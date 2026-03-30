import { pearsonCorrelation } from '../model-evaluation/eval-math.util';

export function priceRowsToDayMap(
  rows: Array<{ date: Date; price: unknown }>,
): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of rows) {
    const t = new Date(r.date).setUTCHours(0, 0, 0, 0);
    const p = Number(r.price);
    if (Number.isFinite(p) && p > 0) m.set(t, p);
  }
  return m;
}

/** بازده‌های روزانه روی تقاطع تاریخ‌های مشترک (مرتب‌شده) */
export function alignedReturns(
  mapA: Map<number, number>,
  mapB: Map<number, number>,
  minPoints = 6,
): { ra: number[]; rb: number[] } | null {
  const dates = [...mapA.keys()]
    .filter((t) => mapB.has(t))
    .sort((x, y) => x - y);
  if (dates.length < minPoints + 1) return null;
  const ra: number[] = [];
  const rb: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const pA0 = mapA.get(dates[i - 1]!)!;
    const pA1 = mapA.get(dates[i]!)!;
    const pB0 = mapB.get(dates[i - 1]!)!;
    const pB1 = mapB.get(dates[i]!)!;
    if (pA0 <= 0 || pB0 <= 0) continue;
    ra.push(pA1 / pA0 - 1);
    rb.push(pB1 / pB0 - 1);
  }
  if (ra.length < minPoints) return null;
  return { ra, rb };
}

export function pearsonFromMaps(
  mapA: Map<number, number>,
  mapB: Map<number, number>,
): number | null {
  const z = alignedReturns(mapA, mapB, 5);
  if (!z) return null;
  return pearsonCorrelation(z.ra, z.rb);
}

export function alignedIndexReturns(
  rowsA: Array<{ snapshotDate: Date; indexValue: number }>,
  rowsB: Array<{ snapshotDate: Date; indexValue: number }>,
): { ra: number[]; rb: number[] } | null {
  const ma = new Map<number, number>();
  for (const r of rowsA) {
    const t = new Date(r.snapshotDate).setUTCHours(0, 0, 0, 0);
    ma.set(t, r.indexValue);
  }
  const mb = new Map<number, number>();
  for (const r of rowsB) {
    const t = new Date(r.snapshotDate).setUTCHours(0, 0, 0, 0);
    mb.set(t, r.indexValue);
  }
  return alignedReturns(ma, mb, 4);
}
