import { PrismaService } from '../prisma/prisma.service';
import { rowsToSeries, type PriceSeries } from '../backtesting/price-series.util';
import { maxDrawdownFromEquity } from '../backtesting/equity.engine';

export type CustomSimResult = {
  totalReturn: number;
  annualReturn: number;
  maxDrawdown: number;
  annualVolatility: number;
  successRate: number;
  worstCase: number | null;
  bestCase: number | null;
  sharpeLike: number;
  tradingDays: number;
};

function utcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function weeklyWinRateFromEquity(eq: number[], step = 5): number {
  if (eq.length < step + 1) return 0;
  let wins = 0;
  let n = 0;
  for (let i = step; i < eq.length; i += step) {
    const j = i - step;
    if (eq[j] <= 0) continue;
    n++;
    if (eq[i] / eq[j] > 1) wins++;
  }
  return n ? wins / n : 0;
}

function annualVolFromEquity(eq: number[]): number {
  const r: number[] = [];
  for (let i = 1; i < eq.length; i++) {
    if (eq[i - 1] > 0) r.push(eq[i] / eq[i - 1] - 1);
  }
  if (r.length < 2) return 0;
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const v =
    r.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, r.length - 1);
  return Math.sqrt(v) * Math.sqrt(252);
}

function sharpeLike(eq: number[]): number {
  const r: number[] = [];
  for (let i = 1; i < eq.length; i++) {
    if (eq[i - 1] > 0) r.push(eq[i] / eq[i - 1] - 1);
  }
  if (r.length < 2) return 0;
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const v =
    r.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, r.length - 1);
  const sd = Math.sqrt(v);
  if (sd < 1e-8) return 0;
  return (m / sd) * Math.sqrt(252);
}

function rollingExtremes(eq: number[], window: number): {
  worst: number | null;
  best: number | null;
} {
  if (eq.length < window + 1) return { worst: null, best: null };
  let worst = Infinity;
  let best = -Infinity;
  for (let i = window; i < eq.length; i++) {
    const a = eq[i - window];
    const b = eq[i];
    if (a <= 0) continue;
    const rr = b / a - 1;
    worst = Math.min(worst, rr);
    best = Math.max(best, rr);
  }
  return {
    worst: Number.isFinite(worst) ? worst : null,
    best: Number.isFinite(best) ? best : null,
  };
}

/**
 * شبیه‌سازی نگه‌داشت ثابت با وزن اولیه (بدون بازتعادل); ارزش نرمال‌شده از روز شروع = ۱.
 */
export async function simulateBuyAndHoldWeighted(
  prisma: PrismaService,
  carIds: string[],
  weights: number[],
  startDate: Date,
  endDate: Date,
): Promise<CustomSimResult | null> {
  if (carIds.length !== weights.length || !carIds.length) return null;
  const ws = weights.reduce((a, b) => a + b, 0);
  if (Math.abs(ws - 1) > 1e-4) return null;

  const start = utcDay(startDate);
  const end = utcDay(endDate);
  const pad = new Date(start);
  pad.setUTCDate(pad.getUTCDate() - 14);

  const rows = await prisma.priceHistory.findMany({
    where: { carId: { in: carIds }, date: { gte: pad, lte: end } },
    orderBy: [{ carId: 'asc' }, { date: 'asc' }],
  });

  const byCar = new Map<string, Array<{ date: Date; price: unknown }>>();
  for (const r of rows) {
    const arr = byCar.get(r.carId) ?? [];
    arr.push({ date: r.date, price: r.price });
    byCar.set(r.carId, arr);
  }

  const seriesMap = new Map<string, PriceSeries>();
  for (const id of carIds) {
    const s = rowsToSeries(byCar.get(id) ?? []);
    if (s.t.length < 5) return null;
    seriesMap.set(id, s);
  }

  const startMs = start.getTime();
  const endMs = end.getTime();
  const dateSet = new Set<number>();
  for (const id of carIds) {
    const s = seriesMap.get(id)!;
    for (let i = 0; i < s.t.length; i++) {
      const ts = s.t[i];
      if (ts >= startMs && ts <= endMs) dateSet.add(ts);
    }
  }
  const allDates = Array.from(dateSet).sort((a, b) => a - b);

  function priceOn(ts: number, s: PriceSeries): number | null {
    let lo = 0;
    let hi = s.t.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (s.t[mid] <= ts) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (ans < 0) return null;
    return s.p[ans] ?? null;
  }

  let t0: number | null = null;
  for (const ts of allDates) {
    let ok = true;
    for (let i = 0; i < carIds.length; i++) {
      const p = priceOn(ts, seriesMap.get(carIds[i])!);
      if (p == null || p <= 0) {
        ok = false;
        break;
      }
    }
    if (ok) {
      t0 = ts;
      break;
    }
  }
  if (t0 == null) return null;

  const p0: number[] = [];
  for (let i = 0; i < carIds.length; i++) {
    const p = priceOn(t0, seriesMap.get(carIds[i])!);
    if (p == null || p <= 0) return null;
    p0.push(p);
  }

  const equity: number[] = [];
  for (const ts of allDates) {
    if (ts < t0) continue;
    let v = 0;
    let ok = true;
    for (let i = 0; i < carIds.length; i++) {
      const pt = priceOn(ts, seriesMap.get(carIds[i])!);
      if (pt == null || pt <= 0 || p0[i] <= 0) {
        ok = false;
        break;
      }
      v += weights[i] * (pt / p0[i]);
    }
    if (!ok) continue;
    equity.push(v);
  }

  if (equity.length < 10) return null;

  const v0 = equity[0];
  const v1 = equity[equity.length - 1];
  const totalReturn = v0 > 0 ? v1 / v0 - 1 : 0;
  const days = Math.max(1, equity.length - 1);
  const annualReturn =
    totalReturn > -1 ? Math.pow(1 + totalReturn, 252 / days) - 1 : -1;
  const maxDd = maxDrawdownFromEquity(equity);
  const { worst, best } = rollingExtremes(equity, Math.min(30, Math.floor(equity.length / 3)));

  return {
    totalReturn,
    annualReturn,
    maxDrawdown: maxDd,
    annualVolatility: annualVolFromEquity(equity),
    successRate: weeklyWinRateFromEquity(equity, 5),
    worstCase: worst,
    bestCase: best,
    sharpeLike: sharpeLike(equity),
    tradingDays: equity.length,
  };
}
