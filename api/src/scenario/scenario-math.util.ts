import { maxDrawdownFromEquity } from '../backtesting/equity.engine';

export function gaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** q در بازه [0,1] — مثلاً 0.05 برای پنجک کمینه */
export function quantileSorted(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export function recoveryDaysToInitial(values: number[]): number | null {
  if (values.length < 2) return null;
  let minI = 0;
  let minV = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] < minV) {
      minV = values[i];
      minI = i;
    }
  }
  const target = values[0];
  for (let j = minI + 1; j < values.length; j++) {
    if (values[j] >= target * 0.995) return j - minI;
  }
  return null;
}

export function metricsFromPath(values: number[]): {
  finalReturn: number;
  maxDrawdown: number;
  recoveryDays: number | null;
} {
  const v0 = values[0] || 1;
  const v1 = values[values.length - 1] ?? v0;
  return {
    finalReturn: v0 > 0 ? v1 / v0 - 1 : 0,
    maxDrawdown: maxDrawdownFromEquity(values),
    recoveryDays: recoveryDaysToInitial(values),
  };
}

export type SegmentOverride = { priceChangePct?: number };

export function segmentExtraDriftPct(
  segment: string | null,
  overrides: unknown,
): number {
  if (overrides == null || typeof overrides !== 'object') return 0;
  const o = overrides as Record<string, SegmentOverride>;
  const key = segment?.trim() || '';
  const seg = o[key]?.priceChangePct;
  if (typeof seg === 'number') return seg;
  const star = o['*']?.priceChangePct;
  return typeof star === 'number' ? star : 0;
}
