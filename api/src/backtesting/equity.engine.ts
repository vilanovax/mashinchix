import { BacktestStrategyName } from '@prisma/client';
import { priceOnOrBefore } from './price-series.util';
import {
  buildTargetAllocation,
  rebalanceToTargets,
  REBALANCE_EVERY,
  type StrategyContext,
} from './strategy-allocations';

export type EquityResult = {
  equity: number[];
  totalReturn: number;
  annualReturn: number;
  maxDrawdown: number;
  winRate: number;
  tradesCount: number;
  sharpeLike: number;
};

export function maxDrawdownFromEquity(eq: number[]): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const v of eq) {
    peak = Math.max(peak, v);
    if (peak > 0) maxDd = Math.max(maxDd, (peak - v) / peak);
  }
  return maxDd;
}

function weeklyWinRate(eq: number[]): { winRate: number; periods: number } {
  if (eq.length < REBALANCE_EVERY + 1) return { winRate: 0, periods: 0 };
  let wins = 0;
  let n = 0;
  for (let i = REBALANCE_EVERY; i < eq.length; i += REBALANCE_EVERY) {
    const j = i - REBALANCE_EVERY;
    if (eq[j] <= 0) continue;
    n++;
    if (eq[i] / eq[j] > 1) wins++;
  }
  return { winRate: n ? wins / n : 0, periods: n };
}

function computeSharpeLike(eq: number[]): number {
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

export function runEquitySimulation(
  strategy: BacktestStrategyName,
  ctx: StrategyContext,
): EquityResult {
  const dates = ctx.globalDates;
  let cash = 1;
  let holdings = new Map<string, number>();
  const equity: number[] = [];
  let tradesCount = 0;

  for (let i = 0; i < dates.length; i++) {
    const dayMs = dates[i];
    let v = cash;
    for (const id of ctx.universe) {
      const ser = ctx.series.get(id);
      if (!ser) continue;
      const sh = holdings.get(id) ?? 0;
      const p = priceOnOrBefore(ser, dayMs);
      if (p != null) v += sh * p;
    }
    equity.push(v);

    const targets = buildTargetAllocation(strategy, i, ctx);
    if (targets !== null) {
      const before = holdings.size + (cash > 1e-12 ? 1 : 0);
      const r = rebalanceToTargets(
        targets,
        holdings,
        cash,
        ctx.universe,
        ctx.series,
        dayMs,
      );
      holdings = r.holdings;
      cash = r.cash;
      const after = holdings.size + (cash > 1e-12 ? 1 : 0);
      if (before !== after || targets.size > 0) tradesCount++;
    }
  }

  const v0 = equity[0] ?? 1;
  const v1 = equity[equity.length - 1] ?? v0;
  const totalReturn = v0 > 0 ? v1 / v0 - 1 : 0;
  const days = Math.max(1, dates.length - 1);
  const annualReturn =
    totalReturn > -1 ? Math.pow(1 + totalReturn, 365 / days) - 1 : -1;
  const maxDrawdown = maxDrawdownFromEquity(equity);
  const { winRate } = weeklyWinRate(equity);
  const sharpeLike = computeSharpeLike(equity);

  return {
    equity,
    totalReturn,
    annualReturn,
    maxDrawdown,
    winRate,
    tradesCount,
    sharpeLike,
  };
}
