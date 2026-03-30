import { toNumber } from '../common/decimal.util';

export type PriceSeries = {
  /** millis UTC start of day */
  t: number[];
  p: number[];
};

export function indexOnOrBefore(t: number[], dayMs: number): number {
  if (!t.length) return -1;
  let lo = 0;
  let hi = t.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= dayMs) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export function priceOnOrBefore(s: PriceSeries, dayMs: number): number | null {
  const i = indexOnOrBefore(s.t, dayMs);
  if (i < 0) return null;
  return s.p[i] ?? null;
}

/** بازده در N قدم معاملاتی گذشته تا روز dayMs (فقط دادهٔ گذشته، بدون همان روز) */
export function returnOverTradingSteps(
  s: PriceSeries,
  dayMs: number,
  stepsBack: number,
): number | null {
  const i = indexOnOrBefore(s.t, dayMs);
  if (i < 0) return null;
  const j = i - stepsBack;
  if (j < 0) return null;
  const a = s.p[i];
  const b = s.p[j];
  if (a == null || b == null || b <= 0) return null;
  return a / b - 1;
}

export function smaOnOrBefore(
  s: PriceSeries,
  dayMs: number,
  window: number,
): number | null {
  const i = indexOnOrBefore(s.t, dayMs);
  if (i < 0 || i + 1 < window) return null;
  let sum = 0;
  for (let k = i - window + 1; k <= i; k++) {
    sum += s.p[k];
  }
  return sum / window;
}

export function approxBuySignal(s: PriceSeries, dayMs: number): boolean {
  const sh = smaOnOrBefore(s, dayMs, 5);
  const lg = smaOnOrBefore(s, dayMs, 20);
  if (sh == null || lg == null || lg <= 0) return false;
  return sh > lg * 1.008;
}

export function approxSellSignal(s: PriceSeries, dayMs: number): boolean {
  const sh = smaOnOrBefore(s, dayMs, 5);
  const lg = smaOnOrBefore(s, dayMs, 20);
  if (sh == null || lg == null || lg <= 0) return false;
  return sh < lg * 0.992;
}

export function rowsToSeries(
  rows: Array<{ date: Date; price: unknown }>,
): PriceSeries {
  const t: number[] = [];
  const p: number[] = [];
  for (const r of rows) {
    const d = r.date.getTime();
    const pv = toNumber(r.price);
    if (pv != null && pv > 0) {
      t.push(d);
      p.push(pv);
    }
  }
  return { t, p };
}

export function utcDayMs(y: number, m: number, d: number): number {
  return Date.UTC(y, m, d);
}
