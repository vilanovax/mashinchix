import { Injectable } from '@nestjs/common';
import { BacktestStrategyName, MarketCycleType, RiskLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type StrategyAdvice = {
  key: string;
  title: string;
  strategy: BacktestStrategyName;
  score: number;
  rationale: string;
};

export type MarketStrategyResult = {
  generatedAt: string;
  holdCash: boolean;
  holdCashReason: string | null;
  primary: StrategyAdvice | null;
  ranked: StrategyAdvice[];
  marketSummary: {
    bullSegmentShare: number;
    avgSegmentMomentum: number | null;
    avgLiquidityScore: number | null;
    avgVolatilityScore: number | null;
    predictionMapeApprox: number | null;
    bestBacktestStrategy: BacktestStrategyName | null;
    bestBacktestAvgReturn: number | null;
  };
  userRiskNote: string | null;
};

@Injectable()
export class StrategyAdvisorService {
  constructor(private readonly prisma: PrismaService) {}

  async recommendStrategy(options?: {
    userId?: string;
  }): Promise<MarketStrategyResult> {
    const userRisk = options?.userId
      ? await this.prisma.user.findUnique({
          where: { id: options.userId },
          select: { riskLevel: true, budget: true, holdYears: true },
        })
      : null;

    const [cycles, segIdx, liqVol, predErr, backtests] = await Promise.all([
      this.prisma.marketCycle.findMany({
        orderBy: { snapshotDate: 'desc' },
        take: 200,
      }),
      this.prisma.segmentMarketIndex.findMany({
        orderBy: { snapshotDate: 'desc' },
        take: 500,
      }),
      this.prisma.carMarketData.aggregate({
        _avg: { liquidityScore: true, volatilityScore: true },
        where: { liquidityScore: { not: null } },
      }),
      this.prisma.predictionEvaluation.aggregate({
        _avg: { pctError: true },
        where: { pctError: { not: null }, actualPrice: { not: null } },
      }),
      this.prisma.backtestResult.groupBy({
        by: ['strategyName'],
        _avg: { totalReturn: true, maxDrawdown: true },
        _count: { id: true },
      }),
    ]);

    const latestBySeg = new Map<string, MarketCycleType>();
    for (const c of cycles) {
      if (!latestBySeg.has(c.segment)) latestBySeg.set(c.segment, c.cycleType);
    }
    let bulls = 0;
    let total = 0;
    for (const v of latestBySeg.values()) {
      total++;
      if (v === MarketCycleType.BULL) bulls++;
    }
    const bullShare = total ? bulls / total : 0;

    const bySeg = new Map<string, typeof segIdx>();
    for (const r of segIdx) {
      const arr = bySeg.get(r.segment) ?? [];
      arr.push(r);
      bySeg.set(r.segment, arr);
    }
    const momentums: number[] = [];
    for (const arr of bySeg.values()) {
      if (arr.length < 2) continue;
      momentums.push(arr[0].indexValue - arr[Math.min(5, arr.length - 1)].indexValue);
    }
    const avgMom = momentums.length
      ? momentums.reduce((a, b) => a + b, 0) / momentums.length
      : null;

    const mape = predErr._avg.pctError != null
      ? Math.abs(Number(predErr._avg.pctError))
      : null;

    const btSorted = [...backtests].sort(
      (a, b) => (b._avg.totalReturn ?? 0) - (a._avg.totalReturn ?? 0),
    );
    const bestBt = btSorted[0];
    const bestStrat = bestBt?.strategyName ?? null;
    const bestRet = bestBt?._avg.totalReturn ?? null;

    const catalog: Omit<StrategyAdvice, 'score'>[] = [
      {
        key: 'momentum',
        title: 'استراتژی مومنتوم',
        strategy: BacktestStrategyName.BUY_HIGH_MOMENTUM,
        rationale: 'خرید خودروهایی با بازده اخیر قوی؛ مناسب بازارهای پرجنب‌وجوش.',
      },
      {
        key: 'low_risk',
        title: 'استراتژی کم‌ریسک',
        strategy: BacktestStrategyName.BUY_LOW_RISK,
        rationale: 'تمرکز بر امتیاز ریسک پایین؛ ترجیح در رکود یا نوسان بالا.',
      },
      {
        key: 'investment_score',
        title: 'امتیاز سرمایه‌گذاری',
        strategy: BacktestStrategyName.BUY_TOP_INVESTMENT_SCORE,
        rationale: 'انتخاب بر اساس investmentScore سیستم؛ تعادل بنیادی خوب.',
      },
      {
        key: 'segment_rotation',
        title: 'چرخش سگمنت',
        strategy: BacktestStrategyName.SEGMENT_ROTATION,
        rationale: 'سوار موج سگمنت‌های پرقدرت نسبت به شاخص.',
      },
      {
        key: 'buy_signal',
        title: 'سیگنال خرید',
        strategy: BacktestStrategyName.BUY_ON_BUY_SIGNAL,
        rationale: 'ورود وقتی سیگنال فنی خرید تقویت شده است.',
      },
      {
        key: 'balanced_cycle',
        title: 'متعادل (چرخه بازار)',
        strategy: BacktestStrategyName.MARKET_CYCLE_STRATEGY,
        rationale: 'سوار سگمنت‌های صعودی در چرخه رسمی بازار.',
      },
      {
        key: 'hold',
        title: 'نگهداری بلندمدت',
        strategy: BacktestStrategyName.HOLD_LONG_TERM,
        rationale: 'پرتفوی بازار با تغییر کم؛ مناسب عدم قطعیت شدید.',
      },
    ];

    const scoreAdvice = (a: (typeof catalog)[number]): number => {
      let s = 0.35;
      if (a.strategy === bestStrat && bestRet != null && bestRet > 0) s += 0.25;
      if (a.strategy === BacktestStrategyName.BUY_HIGH_MOMENTUM && avgMom != null && avgMom > 0)
        s += 0.2;
      if (a.strategy === BacktestStrategyName.SEGMENT_ROTATION && avgMom != null && avgMom > 1)
        s += 0.15;
      if (a.strategy === BacktestStrategyName.MARKET_CYCLE_STRATEGY && bullShare > 0.45)
        s += 0.18;
      if (a.strategy === BacktestStrategyName.BUY_LOW_RISK) {
        const vs = liqVol._avg.volatilityScore;
        if (vs != null && vs < 45) s += 0.2;
        if (bullShare < 0.35) s += 0.15;
      }
      if (a.strategy === BacktestStrategyName.BUY_ON_BUY_SIGNAL && bullShare > 0.4) s += 0.1;
      if (a.strategy === BacktestStrategyName.HOLD_LONG_TERM && bullShare < 0.4 && (mape == null || mape > 0.12))
        s += 0.15;
      if (a.strategy === BacktestStrategyName.BUY_TOP_INVESTMENT_SCORE && mape != null && mape < 0.1)
        s += 0.08;
      if (userRisk?.riskLevel === RiskLevel.LOW && a.strategy === BacktestStrategyName.BUY_LOW_RISK)
        s += 0.2;
      if (userRisk?.riskLevel === RiskLevel.HIGH && a.strategy === BacktestStrategyName.BUY_HIGH_MOMENTUM)
        s += 0.15;
      return s;
    };

    const ranked: StrategyAdvice[] = catalog
      .map((c) => ({ ...c, score: scoreAdvice(c) }))
      .sort((a, b) => b.score - a.score);

    let holdCash = false;
    let holdCashReason: string | null = null;
    if (bullShare < 0.25 && (avgMom ?? 0) < -0.5) {
      holdCash = true;
      holdCashReason =
        'سهم زیادی از سگمنت‌ها در فاز ضعیف و مومنتوم شاخص منفی است؛ احتیاط با نقد یا نگه‌داری تدریجی.';
    }
    if (mape != null && mape > 0.22) {
      holdCashReason = (holdCashReason ? holdCashReason + ' ' : '') +
        'خطای پیش‌بینی بالاست؛ وزن کمتری به پیش‌بینی قیمت بدهید.';
    }

    const userRiskNote = userRisk?.riskLevel
      ? `پروفایل کاربر: ${userRisk.riskLevel} — با استراتژی‌های پیشنهادی هم‌راستا شده است.`
      : null;

    return {
      generatedAt: new Date().toISOString(),
      holdCash,
      holdCashReason,
      primary: ranked[0] ?? null,
      ranked,
      marketSummary: {
        bullSegmentShare: Math.round(bullShare * 1000) / 1000,
        avgSegmentMomentum: avgMom != null ? Math.round(avgMom * 1000) / 1000 : null,
        avgLiquidityScore: liqVol._avg.liquidityScore != null
          ? Math.round(Number(liqVol._avg.liquidityScore) * 10) / 10
          : null,
        avgVolatilityScore: liqVol._avg.volatilityScore != null
          ? Math.round(Number(liqVol._avg.volatilityScore) * 10) / 10
          : null,
        predictionMapeApprox: mape != null ? Math.round(mape * 10000) / 100 : null,
        bestBacktestStrategy: bestStrat,
        bestBacktestAvgReturn: bestRet != null ? Math.round(bestRet * 10000) / 10000 : null,
      },
      userRiskNote,
    };
  }

  async bestFromHistory(limit = 8) {
    const take = Math.min(Math.max(limit, 1), 20);
    const [bt, sim] = await Promise.all([
      this.prisma.backtestResult.groupBy({
        by: ['strategyName'],
        _avg: { totalReturn: true, maxDrawdown: true },
        _count: { id: true },
      }),
      this.prisma.portfolioSimulation.groupBy({
        by: ['strategy'],
        _avg: { totalReturn: true, maxDrawdown: true },
        _count: { id: true },
      }),
    ]);
    type Row = {
      strategy: BacktestStrategyName;
      source: 'backtest' | 'simulation';
      avgReturn: number | null;
      avgDrawdown: number | null;
      runs: number;
    };
    const rows: Row[] = [
      ...bt.map((r) => ({
        strategy: r.strategyName,
        source: 'backtest' as const,
        avgReturn: r._avg.totalReturn ?? null,
        avgDrawdown: r._avg.maxDrawdown ?? null,
        runs: r._count.id,
      })),
      ...sim.map((r) => ({
        strategy: r.strategy,
        source: 'simulation' as const,
        avgReturn: r._avg.totalReturn ?? null,
        avgDrawdown: r._avg.maxDrawdown ?? null,
        runs: r._count.id,
      })),
    ];
    rows.sort((a, b) => (b.avgReturn ?? -1e9) - (a.avgReturn ?? -1e9));
    const seen = new Set<BacktestStrategyName>();
    const out: Row[] = [];
    for (const r of rows) {
      if (seen.has(r.strategy)) continue;
      if (r.strategy === BacktestStrategyName.RECOMMENDATION_HISTORICAL_EVAL)
        continue;
      seen.add(r.strategy);
      out.push(r);
      if (out.length >= take) break;
    }
    return out;
  }

  listStrategiesCatalog(): Omit<StrategyAdvice, 'score'>[] {
    return [
      {
        key: 'momentum',
        title: 'استراتژی مومنتوم',
        strategy: BacktestStrategyName.BUY_HIGH_MOMENTUM,
        rationale: 'خودروهایی با روند قیمت صعودی اخیر.',
      },
      {
        key: 'low_risk',
        title: 'استراتژی کم‌ریسک',
        strategy: BacktestStrategyName.BUY_LOW_RISK,
        rationale: 'اولویت با riskScore پایین‌تر.',
      },
      {
        key: 'investment_score',
        title: 'امتیاز سرمایه‌گذاری',
        strategy: BacktestStrategyName.BUY_TOP_INVESTMENT_SCORE,
        rationale: 'انتخاب بر اساس investmentScore.',
      },
      {
        key: 'segment_rotation',
        title: 'چرخش سگمنت',
        strategy: BacktestStrategyName.SEGMENT_ROTATION,
        rationale: 'تمرکز روی برندهٔ شاخص سگمنت‌ها.',
      },
      {
        key: 'buy_signal',
        title: 'سیگنال خرید',
        strategy: BacktestStrategyName.BUY_ON_BUY_SIGNAL,
        rationale: 'فیلتر سیگنال خرید فنی.',
      },
      {
        key: 'balanced_cycle',
        title: 'متعادل — چرخه بازار',
        strategy: BacktestStrategyName.MARKET_CYCLE_STRATEGY,
        rationale: 'سگمنت‌های گاوی در چرخه بازار.',
      },
      {
        key: 'hold',
        title: 'نگهداری بلندمدت',
        strategy: BacktestStrategyName.HOLD_LONG_TERM,
        rationale: 'خرید اولیهٔ متنوع و نگه‌داری با افت نوسان معاملات.',
      },
      {
        key: 'sell_signal',
        title: 'اجتناب از فروش اجباری',
        strategy: BacktestStrategyName.SELL_ON_SELL_SIGNAL,
        rationale: 'حذف موقعیت‌ها وقتی فشار فروش زیاد است (پرتفوی دفاعی).',
      },
    ];
  }
}
