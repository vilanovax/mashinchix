import { BacktestStrategyName } from '@prisma/client';
import {
  approxBuySignal,
  approxSellSignal,
  returnOverTradingSteps,
  priceOnOrBefore,
  type PriceSeries,
} from './price-series.util';

const TOP_K = 5;
const RET_STEPS = 20;
export const REBALANCE_EVERY = 5;

export type TargetAllocation = Map<string, number>;

export type StrategyContext = {
  universe: string[];
  series: Map<string, PriceSeries>;
  globalDates: number[];
  carSegment: Map<string, string | null>;
  investmentRank: string[];
  lowRiskRank: string[];
  segmentMomentum: Map<string, number>;
  bullSegments: Set<string>;
  weekPicksTop1: Map<number, string | undefined>;
  weekPicksTop3: Map<number, string[] | undefined>;
};

function equalSplit(ids: string[]): TargetAllocation {
  const m = new Map<string, number>();
  if (!ids.length) return m;
  const w = 1 / ids.length;
  for (const id of ids) m.set(id, w);
  return m;
}

function topKByScore(
  universe: string[],
  scoreByCar: Map<string, number>,
  k: number,
  desc: boolean,
): string[] {
  const arr = universe
    .map((id) => ({ id, s: scoreByCar.get(id) ?? (desc ? -1e9 : 1e9) }))
    .filter((x) => Number.isFinite(x.s));
  arr.sort((a, b) => (desc ? b.s - a.s : a.s - b.s));
  return arr.slice(0, k).map((x) => x.id);
}

export function getRebalanceDayIndex(globalIdx: number): boolean {
  if (globalIdx <= 0) return false;
  return globalIdx % REBALANCE_EVERY === 1;
}

/** null = بدون تغییر پورتفو؛ Map خالی = نقد کردن همه */
export function buildTargetAllocation(
  strategy: BacktestStrategyName,
  globalIdx: number,
  ctx: StrategyContext,
): TargetAllocation | null {
  if (globalIdx <= 0) return null;

  const prevMs = ctx.globalDates[globalIdx - 1];
  const { universe, series } = ctx;

  if (strategy === BacktestStrategyName.HOLD_LONG_TERM) {
    if (globalIdx === 1) return equalSplit(universe);
    return null;
  }

  if (!getRebalanceDayIndex(globalIdx)) return null;

  const dayMs = prevMs;

  if (strategy === BacktestStrategyName.BUY_TOP_INVESTMENT_SCORE) {
    const pick = ctx.investmentRank.filter((id) => universe.includes(id)).slice(0, TOP_K);
    return equalSplit(pick.length ? pick : universe.slice(0, TOP_K));
  }

  if (strategy === BacktestStrategyName.BUY_LOW_RISK) {
    const pick = ctx.lowRiskRank.filter((id) => universe.includes(id)).slice(0, TOP_K);
    return equalSplit(pick.length ? pick : universe.slice(0, TOP_K));
  }

  if (strategy === BacktestStrategyName.BUY_HIGH_MOMENTUM) {
    const score = new Map<string, number>();
    for (const id of universe) {
      const s = series.get(id);
      if (!s) continue;
      const r = returnOverTradingSteps(s, dayMs, RET_STEPS);
      if (r != null) score.set(id, r);
    }
    const pick = topKByScore(universe, score, TOP_K, true);
    return equalSplit(pick);
  }

  if (strategy === BacktestStrategyName.BUY_UNDERVALUE) {
    const score = new Map<string, number>();
    for (const id of universe) {
      const s = series.get(id);
      if (!s) continue;
      const r = returnOverTradingSteps(s, dayMs, RET_STEPS);
      if (r != null) score.set(id, r);
    }
    const pick = topKByScore(universe, score, TOP_K, false);
    return equalSplit(pick);
  }

  if (strategy === BacktestStrategyName.BUY_ON_BUY_SIGNAL) {
    const picks: string[] = [];
    for (const id of universe) {
      const s = series.get(id);
      if (s && approxBuySignal(s, dayMs)) picks.push(id);
    }
    return equalSplit(picks.slice(0, TOP_K));
  }

  if (strategy === BacktestStrategyName.SELL_ON_SELL_SIGNAL) {
    const picks: string[] = [];
    for (const id of universe) {
      const s = series.get(id);
      if (s && !approxSellSignal(s, dayMs)) picks.push(id);
    }
    return equalSplit(picks.slice(0, TOP_K));
  }

  if (strategy === BacktestStrategyName.SEGMENT_ROTATION) {
    let bestSeg: string | null = null;
    let bestM = -1e9;
    for (const [seg, m] of ctx.segmentMomentum) {
      if (m > bestM) {
        bestM = m;
        bestSeg = seg;
      }
    }
    if (!bestSeg || bestM < -1e8) return new Map();
    const pick = universe.filter((id) => (ctx.carSegment.get(id) ?? '') === bestSeg);
    return equalSplit(pick.slice(0, TOP_K));
  }

  if (strategy === BacktestStrategyName.MARKET_CYCLE_STRATEGY) {
    const pick = universe.filter((id) => {
      const seg = ctx.carSegment.get(id);
      return seg != null && ctx.bullSegments.has(seg);
    });
    return equalSplit(pick.slice(0, TOP_K));
  }

  if (strategy === BacktestStrategyName.RECOMMENDATION_TOP1) {
    const wk = Math.floor(globalIdx / REBALANCE_EVERY);
    const car = ctx.weekPicksTop1.get(wk);
    return car ? equalSplit([car]) : new Map();
  }

  if (strategy === BacktestStrategyName.RECOMMENDATION_TOP3) {
    const wk = Math.floor(globalIdx / REBALANCE_EVERY);
    const cars = ctx.weekPicksTop3.get(wk);
    return cars?.length ? equalSplit(cars.slice(0, 3)) : new Map();
  }

  return null;
}

export function rebalanceToTargets(
  targets: TargetAllocation,
  holdings: Map<string, number>,
  cash: number,
  universe: string[],
  series: Map<string, PriceSeries>,
  dayMs: number,
): { holdings: Map<string, number>; cash: number } {
  let equity = cash;
  const prices = new Map<string, number>();
  for (const id of universe) {
    const sh = holdings.get(id) ?? 0;
    const ser = series.get(id);
    if (!ser) continue;
    const p = priceOnOrBefore(ser, dayMs);
    if (p != null && p > 0) {
      prices.set(id, p);
      equity += sh * p;
    }
  }

  if (equity <= 0) {
    return { holdings: new Map(), cash: 0 };
  }

  if (targets.size === 0) {
    let c = cash;
    for (const id of universe) {
      const sh = holdings.get(id) ?? 0;
      const p = prices.get(id);
      if (p != null) c += sh * p;
    }
    return { holdings: new Map(), cash: c };
  }

  const nextH = new Map<string, number>();
  let used = 0;
  for (const [id, w] of targets) {
    const p = prices.get(id);
    if (p == null || p <= 0) continue;
    const val = equity * w;
    const sh = val / p;
    nextH.set(id, sh);
    used += val;
  }
  const nextCash = equity - used;
  return { holdings: nextH, cash: nextCash };
}
