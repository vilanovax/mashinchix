import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BacktestStrategyName, MarketCycleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildStrategyContext } from '../backtesting/backtesting-context';
import { runEquitySimulation } from '../backtesting/equity.engine';
import { simulateBuyAndHoldWeighted } from './custom-portfolio-sim.util';

export type RiskTolerance = 'LOW' | 'MEDIUM' | 'HIGH';
export type StrategyPreference =
  | 'growth'
  | 'income'
  | 'low-risk'
  | 'balanced';

export type RecommendPortfolioParams = {
  budget: number;
  riskTolerance: RiskTolerance;
  investmentHorizonMonths: number;
  preferredSegments?: string[];
  maxCars: number;
  strategyPreference: StrategyPreference;
  userId?: string;
  persist?: boolean;
};

type Cand = {
  id: string;
  brand: string;
  model: string;
  year: number;
  segment: string | null;
  inv: number;
  risk: number;
  mom: number;
  liq: number;
  vol: number;
  volRaw: number | null;
  predCh: number;
  trendScore: number;
  signalBoost: number;
  daysToSell: number | null;
  avgPrice: number | null;
  cycleBoost: number;
  segTrend: number;
};

function normMap(values: number[]): Map<number, number> {
  const sorted = [...values].filter((x) => Number.isFinite(x));
  if (!sorted.length) return new Map();
  const lo = Math.min(...sorted);
  const hi = Math.max(...sorted);
  const m = new Map<number, number>();
  for (const v of values) {
    if (!Number.isFinite(v)) m.set(v, 0.5);
    else if (hi - lo < 1e-9) m.set(v, 0.5);
    else m.set(v, (v - lo) / (hi - lo));
  }
  return m;
}

function maxMaxCar(rt: RiskTolerance): number {
  if (rt === 'LOW') return 0.3;
  if (rt === 'MEDIUM') return 0.35;
  return 0.4;
}

function maxPerSegmentCount(rt: RiskTolerance): number {
  if (rt === 'LOW') return 2;
  if (rt === 'MEDIUM') return 3;
  return 4;
}

export function mapStrategyPreferenceToBacktestStrategy(
  sp: StrategyPreference,
): BacktestStrategyName {
  switch (sp) {
    case 'growth':
      return BacktestStrategyName.BUY_HIGH_MOMENTUM;
    case 'income':
      return BacktestStrategyName.BUY_TOP_INVESTMENT_SCORE;
    case 'low-risk':
      return BacktestStrategyName.BUY_LOW_RISK;
    case 'balanced':
    default:
      return BacktestStrategyName.MARKET_CYCLE_STRATEGY;
  }
}

function allocateWithCaps(
  raw: number[],
  segments: string[],
  maxCar: number,
  maxSeg: number,
): number[] {
  let w = raw.map((r) => Math.max(1e-6, r));
  let s = w.reduce((a, b) => a + b, 0);
  w = w.map((x) => x / s);

  for (let iter = 0; iter < 25; iter++) {
    let changed = false;
    for (let i = 0; i < w.length; i++) {
      if (w[i] > maxCar + 1e-9) {
        const ex = w[i] - maxCar;
        w[i] = maxCar;
        const rest = w.reduce((a, x, j) => a + (j === i ? 0 : x), 0);
        if (rest > 1e-12) {
          for (let j = 0; j < w.length; j++) {
            if (j !== i) w[j] += ex * (w[j] / rest);
          }
        }
        changed = true;
      }
    }

    const bySeg = new Map<string, number>();
    w.forEach((x, i) => {
      const seg = segments[i] || '_';
      bySeg.set(seg, (bySeg.get(seg) ?? 0) + x);
    });

    for (const [seg, tot] of bySeg) {
      if (tot > maxSeg + 1e-9) {
        const ex = tot - maxSeg;
        const idx = w.map((_, i) => i).filter((i) => (segments[i] || '_') === seg);
        const sub = idx.reduce((a, i) => a + w[i], 0);
        if (sub < 1e-12) continue;
        idx.forEach((i) => {
          w[i] -= ex * (w[i] / sub);
        });
        const oidx = w.map((_, i) => i).filter((i) => (segments[i] || '_') !== seg);
        const osub = oidx.reduce((a, i) => a + w[i], 0);
        if (osub > 1e-12) {
          oidx.forEach((i) => {
            w[i] += ex * (w[i] / osub);
          });
        }
        changed = true;
      }
    }

    const tn = w.reduce((a, b) => a + b, 0);
    if (tn > 1e-12) w = w.map((x) => x / tn);

    if (!changed) break;
  }

  for (let i = 0; i < w.length; i++) w[i] = Math.max(0, w[i]);
  const t = w.reduce((a, b) => a + b, 0);
  return t > 1e-12 ? w.map((x) => x / t) : w.map(() => 1 / w.length);
}

@Injectable()
export class PortfolioRecommendationService {
  private readonly logger = new Logger(PortfolioRecommendationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recommendPortfolio(params: RecommendPortfolioParams) {
    const maxcars = Math.min(Math.max(params.maxCars || 5, 3), 12);
    const budget = params.budget;
    if (!Number.isFinite(budget) || budget <= 0) {
      throw new BadRequestException('بودجه نامعتبر است');
    }

    const [latestCycles, segIndexRecent] = await Promise.all([
      this.prisma.marketCycle.findMany({
        orderBy: [{ snapshotDate: 'desc' }],
        take: 400,
      }),
      this.prisma.segmentMarketIndex.findMany({
        orderBy: [{ snapshotDate: 'desc' }],
        take: 800,
      }),
    ]);

    const cycleBySeg = new Map<string, MarketCycleType>();
    for (const c of latestCycles) {
      if (!cycleBySeg.has(c.segment)) cycleBySeg.set(c.segment, c.cycleType);
    }

    const segTrendBySeg = new Map<string, number>();
    const bySegRows = new Map<string, typeof segIndexRecent>();
    for (const r of segIndexRecent) {
      const arr = bySegRows.get(r.segment) ?? [];
      arr.push(r);
      bySegRows.set(r.segment, arr);
    }
    for (const [seg, arr] of bySegRows) {
      if (arr.length < 2) continue;
      const a = arr[0].indexValue;
      const b = arr[Math.min(5, arr.length - 1)].indexValue;
      if (Number.isFinite(a) && Number.isFinite(b)) segTrendBySeg.set(seg, a - b);
    }

    const where: Prisma.CarWhereInput = {
      scores: {
        investmentScore: { not: null },
        riskScore: { not: null },
      },
      marketData: { avgPrice: { not: null, gt: 0 } },
    };
    if (params.preferredSegments?.length) {
      where.segment = { in: params.preferredSegments };
    }

    const cars = await this.prisma.car.findMany({
      where,
      take: 280,
      include: {
        scores: true,
        marketData: true,
        pricePrediction: true,
        liquidityStatsSnapshots: {
          orderBy: { snapshotDate: 'desc' },
          take: 1,
        },
      },
    });

    const cand: Cand[] = [];
    for (const c of cars) {
      const md = c.marketData;
      const sc = c.scores;
      const pp = c.pricePrediction;
      if (!md?.avgPrice || !sc?.investmentScore || sc.riskScore == null) continue;
      const avgPrice = Number(md.avgPrice);
      if (!Number.isFinite(avgPrice) || avgPrice > budget * 0.95) continue;

      const inv = sc.investmentScore;
      const risk = sc.riskScore;
      const mom =
        md.momentumScore ??
        (md.priceChange7d != null ? Number(md.priceChange7d) : 0);
      const liq = md.liquidityScore ?? 50;
      const vol = md.volatilityScore ?? 50;
      const volRaw = md.volatilityRaw != null ? Number(md.volatilityRaw) : null;
      const h = params.investmentHorizonMonths;
      const predCh =
        h <= 4
          ? Number(pp?.predictedChange30d ?? 0)
          : Number(pp?.predictedChange90d ?? pp?.predictedChange30d ?? 0);
      const trendScore = md.priceTrendScore ?? 0;
      const sig = md.marketSignal === 'BUY' ? 1 : md.marketSignal === 'SELL' ? -0.5 : 0;
      const liqSnap = c.liquidityStatsSnapshots[0];
      const daysToSell = liqSnap?.medianDaysToSell ?? liqSnap?.avgDaysToSell ?? null;
      const seg = c.segment ?? '';
      const ct = cycleBySeg.get(seg);
      const cycleBoost =
        ct === MarketCycleType.BULL ? 1 : ct === MarketCycleType.BEAR ? -0.5 : 0;
      const segTrend = segTrendBySeg.get(seg) ?? 0;

      cand.push({
        id: c.id,
        brand: c.brand,
        model: c.model,
        year: c.year,
        segment: c.segment,
        inv,
        risk,
        mom: Number.isFinite(mom) ? mom : 0,
        liq,
        vol,
        volRaw,
        predCh: Number.isFinite(predCh) ? predCh : 0,
        trendScore,
        signalBoost: sig,
        daysToSell,
        avgPrice,
        cycleBoost,
        segTrend,
      });
    }

    if (cand.length < 3) {
      return {
        ok: false,
        message: 'خودروی کافی با قیمت و امتیاز برای بودجه وجود ندارد',
        cars: [],
        weights: [],
        expectedReturn: null,
        expectedVolatility: null,
        expectedDrawdown: null,
        investmentScorePortfolio: null,
        explanation: [],
        historicalBacktest: null,
      };
    }

    const sp = params.strategyPreference;
    const rt = params.riskTolerance;

    const invN = normMap(cand.map((x) => x.inv));
    const riskN = normMap(cand.map((x) => x.risk));
    const momN = normMap(cand.map((x) => x.mom + 0.01));
    const liqN = normMap(cand.map((x) => x.liq));
    const volN = normMap(cand.map((x) => x.vol));
    const predN = normMap(cand.map((x) => x.predCh + 0.02));
    const trendNn = normMap(cand.map((x) => x.trendScore));
    const dts = cand.map((x) =>
      x.daysToSell != null && Number.isFinite(x.daysToSell) ? -x.daysToSell : 0,
    );
    const dtsN = normMap(dts);

    const wSp =
      sp === 'growth'
        ? { inv: 0.15, risk: 0.1, mom: 0.28, liq: 0.08, vol: 0.04, pred: 0.2, tr: 0.1, cy: 0.03, sg: 0.02 }
        : sp === 'income'
          ? { inv: 0.35, risk: 0.12, mom: 0.12, liq: 0.2, vol: 0.06, pred: 0.12, tr: 0.08, cy: 0.03, sg: 0.02 }
          : sp === 'low-risk'
            ? { inv: 0.18, risk: 0.22, mom: 0.08, liq: 0.18, vol: 0.18, pred: 0.06, tr: 0.05, cy: 0.03, sg: 0.02 }
            : { inv: 0.22, risk: 0.15, mom: 0.15, liq: 0.15, vol: 0.1, pred: 0.12, tr: 0.1, cy: 0.03, sg: 0.02 };

    const riskPenalty =
      rt === 'LOW' ? 1.25 : rt === 'MEDIUM' ? 1 : 0.85;

    const composite = cand.map((c) => {
      const i = invN.get(c.inv) ?? 0.5;
      const r = riskN.get(c.risk) ?? 0.5;
      const m = momN.get(c.mom + 0.01) ?? 0.5;
      const l = liqN.get(c.liq) ?? 0.5;
      const v = volN.get(c.vol) ?? 0.5;
      const p = predN.get(c.predCh + 0.02) ?? 0.5;
      const t = trendNn.get(c.trendScore) ?? 0.5;
      const ds = dtsN.get(c.daysToSell != null ? -c.daysToSell : 0) ?? 0.5;
      const riskAdj = (1 - r) * riskPenalty;
      const volAdj = (1 - v) * (rt === 'LOW' ? 0.4 : rt === 'MEDIUM' ? 0.2 : 0.05);
      const cyclePart = c.cycleBoost * 0.15 + Math.tanh(c.segTrend / 50) * 0.1;
      const score =
        wSp.inv * i +
        wSp.risk * riskAdj +
        wSp.mom * m +
        wSp.liq * l +
        wSp.vol * volAdj +
        wSp.pred * p +
        wSp.tr * t +
        wSp.cy * cyclePart +
        wSp.sg * (c.signalBoost > 0 ? 1 : 0) +
        0.05 * ds;
      return { c, score };
    });

    composite.sort((a, b) => b.score - a.score);

    const maxSegCount = maxPerSegmentCount(rt);
    const picked: Cand[] = [];
    const segCount = new Map<string, number>();

    for (const { c } of composite) {
      if (picked.length >= maxcars) break;
      const seg = c.segment || '_none';
      if ((segCount.get(seg) ?? 0) >= maxSegCount) continue;
      if (rt === 'LOW') {
        const sameSeg = picked.filter((p) => (p.segment || '') === seg).length;
        const sameTrend = picked.filter(
          (p) => Math.sign(p.predCh || 0) === Math.sign(c.predCh || 0),
        ).length;
        if (sameSeg >= 1 && sameTrend >= 2) continue;
      }
      picked.push(c);
      segCount.set(seg, (segCount.get(seg) ?? 0) + 1);
    }

    if (picked.length < 2) {
      for (const { c } of composite) {
        if (picked.some((p) => p.id === c.id)) continue;
        picked.push(c);
        if (picked.length >= Math.min(3, maxcars)) break;
      }
    }

    const rawW = picked.map((p) => {
      const base = composite.find((x) => x.c.id === p.id)?.score ?? 1;
      return Math.max(0.05, base);
    });
    const segs = picked.map((p) => p.segment || '_none');
    const weights = allocateWithCaps(
      rawW,
      segs,
      maxMaxCar(rt),
      0.6,
    );

    const invPort = picked.reduce((a, p, i) => a + (p.inv ?? 0) * weights[i], 0);

    const expRetAnnual =
      picked.reduce((a, p, i) => a + weights[i] * (p.predCh || 0), 0) *
      (params.investmentHorizonMonths >= 6 ? 2 : 4);

    const expVol =
      picked.reduce((a, p, i) => a + weights[i] * ((p.volRaw != null ? p.volRaw : p.vol / 20) || 0.05), 0) *
      Math.sqrt(252 / 30);

    const expDd = Math.min(
      0.85,
      expVol * Math.sqrt(params.investmentHorizonMonths / 12) * 1.2,
    );

    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - Math.min(365, Math.max(90, params.investmentHorizonMonths * 30)));

    const custom = await simulateBuyAndHoldWeighted(
      this.prisma,
      picked.map((p) => p.id),
      weights,
      start,
      end,
    );

    let similarStrategy: {
      strategy: BacktestStrategyName;
      totalReturn: number;
      maxDrawdown: number;
      annualReturn: number;
      successRate: number;
      winRate: number;
    } | null = null;

    try {
      const strat = mapStrategyPreferenceToBacktestStrategy(sp);
      const ctx = await buildStrategyContext(this.prisma, start, end);
      const eq = runEquitySimulation(strat, ctx);
      similarStrategy = {
        strategy: strat,
        totalReturn: eq.totalReturn,
        maxDrawdown: eq.maxDrawdown,
        annualReturn: eq.annualReturn,
        successRate: eq.winRate,
        winRate: eq.winRate,
      };
    } catch (e) {
      this.logger.warn(`Similar strategy sim skipped: ${e}`);
    }

    const explanation: string[] = [];
    explanation.push(
      `ترجیح استراتژی «${sp}» و تحمل ریسک «${rt}» با افق حدود ${params.investmentHorizonMonths} ماه.`,
    );
    explanation.push(
      `حداکثر وزن هر خودرو ${(maxMaxCar(rt) * 100).toFixed(0)}٪ و هر سگمنت حداکثر ۶۰٪ با تنوع سگمنتی اعمال شد.`,
    );
    if (picked.some((p) => (cycleBySeg.get(p.segment ?? '') === MarketCycleType.BULL)))
      explanation.push('بخشی از سبد در سگمنت‌هایی با چرخه صعودی بازار قرار دارد.');
    if (rt === 'LOW')
      explanation.push('اولویت با کاهش همبستگی سگمنتی و نوسان پایین‌تر بوده است.');

    const out = {
      ok: true,
      cars: picked.map((p, i) => ({
        carId: p.id,
        brand: p.brand,
        model: p.model,
        year: p.year,
        segment: p.segment,
        weight: weights[i],
        weightPct: Math.round(weights[i] * 10000) / 100,
        approxCapital: Math.round(weights[i] * budget),
        investmentScore: p.inv,
        riskScore: p.risk,
        momentumScore: p.mom,
        liquidityScore: p.liq,
        predictedChangeHint: p.predCh,
      })),
      weights,
      expectedReturn: expRetAnnual,
      expectedVolatility: expVol,
      expectedDrawdown: expDd,
      investmentScorePortfolio: invPort,
      explanation,
      historicalBacktest: {
        customPortfolio: custom,
        similarStrategy,
        window: { start: start.toISOString(), end: end.toISOString() },
      },
    };

    if (params.persist && params.userId) {
      await this.prisma.userPortfolioRecommendation.create({
        data: {
          userId: params.userId,
          budget: new Prisma.Decimal(Math.round(budget)),
          params: params as unknown as Prisma.InputJsonValue,
          result: out as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return out;
  }
}
