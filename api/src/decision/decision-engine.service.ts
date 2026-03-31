import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BacktestStrategyName,
  DecisionMarketAction,
  DecisionMarketOutlook,
  DecisionPortfolioAction,
  DecisionStrategyAction,
  MarketCycleType,
  Prisma,
  RiskLevel,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StrategyAdvisorService } from '../portfolio/strategy-advisor.service';
import { AdvisorExplanationService } from './advisor-explanation.service';
import { computeDecisionConfidence } from './decision-confidence.util';
import type { DecisionCarHint, DecisionSummaryPayload } from './decision.types';
import {
  AdaptiveWeightService,
  SCOPE_DECISION_CONFIDENCE,
} from '../learning/adaptive-weight.service';

function utcDateOnly(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapStrategyKey(
  primary: BacktestStrategyName | null,
  holdCash: boolean,
): DecisionStrategyAction {
  if (holdCash) return DecisionStrategyAction.CASH;
  switch (primary) {
    case BacktestStrategyName.BUY_HIGH_MOMENTUM:
      return DecisionStrategyAction.MOMENTUM;
    case BacktestStrategyName.BUY_LOW_RISK:
      return DecisionStrategyAction.LOW_RISK;
    case BacktestStrategyName.SEGMENT_ROTATION:
    case BacktestStrategyName.MARKET_CYCLE_STRATEGY:
      return DecisionStrategyAction.SEGMENT_ROTATION;
    default:
      return DecisionStrategyAction.BALANCED;
  }
}

@Injectable()
export class DecisionEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly strategyAdvisor: StrategyAdvisorService,
    private readonly advisorText: AdvisorExplanationService,
    private readonly adaptive: AdaptiveWeightService,
  ) {}

  async generateDecisionSummary(
    userId?: string,
    options?: { persist?: boolean },
  ): Promise<DecisionSummaryPayload & { snapshotId?: string | null }> {
    if (userId) {
      const u = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!u) throw new NotFoundException('کاربر یافت نشد');
    }

    const today = utcDateOnly(new Date());
    const dateStr = fmtDate(today);
    const snapshotKey = userId ? `user:${userId}:${dateStr}` : `market:${dateStr}`;

    const [
      strategyAdvice,
      cycles,
      segIdx,
      liqVol,
      predErr,
      buySellStats,
      crashStress,
      insightsOpp,
      insightsWarn,
    ] = await Promise.all([
      this.strategyAdvisor.recommendStrategy({ userId }),
      this.prisma.marketCycle.findMany({
        orderBy: { snapshotDate: 'desc' },
        take: 250,
      }),
      this.prisma.segmentMarketIndex.findMany({
        orderBy: { snapshotDate: 'desc' },
        take: 600,
      }),
      this.prisma.carMarketData.aggregate({
        _avg: { liquidityScore: true, volatilityScore: true },
        where: { liquidityScore: { not: null } },
      }),
      this.prisma.predictionEvaluation.aggregate({
        _avg: { pctError: true },
        where: { pctError: { not: null }, actualPrice: { not: null } },
      }),
      this.prisma.carMarketData.groupBy({
        by: ['marketSignal'],
        _count: { id: true },
        where: { marketSignal: { not: null } },
      }),
      this.prisma.portfolioStressTest.findFirst({
        where: { scenarioId: 'scen_market_crash' },
        orderBy: { createdAt: 'desc' },
        select: { maxDrawdown: true, survivalProbability: true },
      }),
      this.prisma.marketInsight.findMany({
        where: {
          insightType: {
            in: [
              'BEST_INVESTMENT_OPPORTUNITY',
              'UNDERVALUED',
              'ENTERING_BULL_TREND',
            ],
          },
          snapshotDate: { gte: new Date(Date.now() - 14 * 86400000) },
        },
        take: 12,
        orderBy: { score: 'desc' },
      }),
      this.prisma.marketInsight.findMany({
        where: {
          OR: [
            { insightType: 'HIGH_RISK_ALERT' },
            { insightType: 'ENTERING_BEAR_TREND' },
            { insightType: 'OVERVALUED' },
            { insightType: 'FASTEST_FALLING_PRICE' },
          ],
          snapshotDate: { gte: new Date(Date.now() - 14 * 86400000) },
        },
        take: 12,
        orderBy: { score: 'desc' },
      }),
    ]);

    const latestBySeg = new Map<string, MarketCycleType>();
    for (const c of cycles) {
      if (!latestBySeg.has(c.segment)) latestBySeg.set(c.segment, c.cycleType);
    }
    let bulls = 0,
      bears = 0,
      stables = 0;
    for (const v of latestBySeg.values()) {
      if (v === MarketCycleType.BULL) bulls++;
      else if (v === MarketCycleType.BEAR) bears++;
      else stables++;
    }
    const t = bulls + bears + stables || 1;
    const bullShare = bulls / t;
    const bearShare = bears / t;

    const bySegRows = new Map<string, typeof segIdx>();
    for (const r of segIdx) {
      const arr = bySegRows.get(r.segment) ?? [];
      arr.push(r);
      bySegRows.set(r.segment, arr);
    }
    const segmentMomentum = new Map<string, number>();
    for (const [seg, arr] of bySegRows) {
      if (arr.length < 2) continue;
      segmentMomentum.set(
        seg,
        arr[0]!.indexValue - arr[Math.min(5, arr.length - 1)]!.indexValue,
      );
    }

    const sortedSeg = [...segmentMomentum.entries()].sort(
      (a, b) => b[1] - a[1],
    );
    const topSeg = sortedSeg.slice(0, 4).map(([s]) => s);
    const weakSeg = sortedSeg.slice(-3).map(([s]) => s);
    const avoidSegments: string[] = [];
    for (const [seg, typ] of latestBySeg) {
      if (typ === MarketCycleType.BEAR && weakSeg.includes(seg))
        avoidSegments.push(seg);
    }

    const avgMom =
      sortedSeg.length > 0
        ? sortedSeg.reduce((a, [, m]) => a + m, 0) / sortedSeg.length
        : null;

    const totalSig = buySellStats.reduce((a, x) => a + x._count.id, 0);
    const buyCnt =
      buySellStats.find((x) => x.marketSignal === 'BUY')?._count.id ?? 0;
    const sellCnt =
      buySellStats.find((x) => x.marketSignal === 'SELL')?._count.id ?? 0;
    const buyRatio = totalSig ? buyCnt / totalSig : 0;

    let marketOutlook: DecisionMarketOutlook;
    if (bullShare >= 0.42 && (avgMom ?? 0) >= -0.3) marketOutlook = DecisionMarketOutlook.BULL;
    else if (bearShare >= 0.35 || (avgMom ?? 0) < -1.5)
      marketOutlook = DecisionMarketOutlook.BEAR;
    else marketOutlook = DecisionMarketOutlook.SIDEWAYS;

    const volAvg = liqVol._avg.volatilityScore;
    const highVol = volAvg != null && volAvg > 56;

    let marketDecision: DecisionMarketAction;
    if (strategyAdvice.holdCash) marketDecision = DecisionMarketAction.WAIT;
    else if (highVol && marketOutlook !== DecisionMarketOutlook.BULL)
      marketDecision = DecisionMarketAction.CAUTIOUS;
    else if (marketOutlook === DecisionMarketOutlook.BEAR && bearShare > 0.38)
      marketDecision = DecisionMarketAction.WAIT;
    else if (
      marketOutlook === DecisionMarketOutlook.BULL &&
      bullShare > 0.48 &&
      !highVol
    )
      marketDecision = DecisionMarketAction.BUY;
    else if (sellCnt > buyCnt * 1.4 && totalSig > 30)
      marketDecision = DecisionMarketAction.SELL;
    else if (marketOutlook === DecisionMarketOutlook.SIDEWAYS)
      marketDecision = DecisionMarketAction.HOLD;
    else marketDecision = DecisionMarketAction.CAUTIOUS;

    const strategyDecision = mapStrategyKey(
      strategyAdvice.primary?.strategy ?? null,
      strategyAdvice.holdCash,
    );

    const mapeApprox = predErr._avg.pctError != null
      ? Math.abs(Number(predErr._avg.pctError))
      : null;
    const dcWeights = await this.adaptive.getWeights(SCOPE_DECISION_CONFIDENCE);
    const confidenceScore = computeDecisionConfidence(
      {
        mapeApprox,
        bullShare,
        avgVolatilityScore: volAvg != null ? Number(volAvg) : null,
        buySignalRatio: buyRatio,
        bearShare,
        avgMomentum: avgMom,
        stressMaxDd: crashStress?.maxDrawdown ?? null,
      },
      dcWeights,
    );

    let riskLevel: RiskLevel = RiskLevel.MEDIUM;
    if (
      highVol ||
      bearShare > 0.38 ||
      (crashStress?.maxDrawdown ?? 0) > 0.42
    )
      riskLevel = RiskLevel.HIGH;
    else if (
      bullShare > 0.52 &&
      (avgMom ?? 0) > 0.5 &&
      !highVol
    )
      riskLevel = RiskLevel.LOW;

    if (userId) {
      const bp = await this.prisma.userBehaviorProfile.findUnique({
        where: { userId },
      });
      const br = bp?.riskTolerance;
      if (br != null && br < 0.4 && riskLevel === RiskLevel.HIGH) {
        riskLevel = RiskLevel.MEDIUM;
      }
      if (
        br != null &&
        br > 0.68 &&
        riskLevel === RiskLevel.LOW &&
        marketOutlook === DecisionMarketOutlook.BULL
      ) {
        riskLevel = RiskLevel.MEDIUM;
      }
    }

    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { riskLevel: true, budget: true },
        })
      : null;
    if (user?.riskLevel === RiskLevel.LOW && riskLevel === RiskLevel.HIGH) {
      /* keep market risk but user is conservative */
    }

    let portfolioDecision: DecisionPortfolioAction =
      DecisionPortfolioAction.HOLD;
    if (userId) {
      const watch = await this.prisma.userWatchlist.findMany({
        where: { userId },
        include: {
          car: {
            include: { marketData: true, scores: true },
          },
        },
      });
      let sellSignals = 0,
        highRisk = 0;
      for (const w of watch) {
        if (w.car.marketData?.marketSignal === 'SELL') sellSignals++;
        if ((w.car.scores?.riskScore ?? 0) > 78) highRisk++;
      }
      if (sellSignals >= 2 || highRisk >= 2)
        portfolioDecision = DecisionPortfolioAction.REDUCE_RISK;
      else if (
        marketDecision === DecisionMarketAction.BUY &&
        user?.riskLevel === RiskLevel.HIGH
      )
        portfolioDecision = DecisionPortfolioAction.REBALANCE;
      else if (
        marketOutlook === DecisionMarketOutlook.BULL &&
        user?.riskLevel === RiskLevel.LOW
      )
        portfolioDecision = DecisionPortfolioAction.INCREASE_RISK;
      else if (watch.length > 6 && sellSignals >= 1)
        portfolioDecision = DecisionPortfolioAction.REBALANCE;
    } else {
      if (marketDecision === DecisionMarketAction.CAUTIOUS)
        portfolioDecision = DecisionPortfolioAction.REDUCE_RISK;
    }

    const bestCarsToBuy = await this.pickBuyCandidates();
    const carsToSell = await this.pickSellCandidates(userId);

    const marketCycleSummary = `${Math.round(bullShare * 100)}٪ سگمنت‌ها گاوی، ${Math.round(bearShare * 100)}٪ خرسی`;

    const keyFactors: string[] = [
      `سهم فاز گاوی در چرخه: ${(bullShare * 100).toFixed(0)}٪`,
      avgMom != null
        ? `میانگین مومنتوم شاخص سگمنت: ${avgMom.toFixed(2)}`
        : 'مومنتوم شاخص نامشخص',
      volAvg != null
        ? `میانگین نمره نوسان بازار: ${Number(volAvg).toFixed(1)}`
        : '',
      `نسبت سیگنال خرید در نمونه آگهی‌ها: ${(buyRatio * 100).toFixed(0)}٪`,
      strategyAdvice.primary
        ? `استراتژی اولویت‌دار: ${strategyAdvice.primary.title}`
        : '',
    ].filter(Boolean);

    const warnings: string[] = [];
    if (strategyAdvice.holdCashReason) warnings.push(strategyAdvice.holdCashReason);
    if (highVol) warnings.push('نوسان بازار بالاست؛ حجم ورود را کنترل کنید.');
    if (mapeApprox != null && mapeApprox > 0.18)
      warnings.push('خطای پیش‌بینی مدل بالا است؛ وزن کمتری به قیمت هدف بدهید.');
    for (const i of insightsWarn) {
      warnings.push(`${i.title}: ${i.description.slice(0, 160)}`);
    }

    const opportunities: string[] = [];
    for (const i of insightsOpp) {
      opportunities.push(`${i.title}: ${i.description.slice(0, 160)}`);
    }
    if (!opportunities.length && marketOutlook === DecisionMarketOutlook.BULL)
      opportunities.push('فاز کلی بازار مثبت‌تر است؛ فرصت‌های سگمنت‌های برتر را بررسی کنید.');

    const worstScenario = await this.prisma.marketScenario.findUnique({
      where: { id: 'scen_market_crash' },
      select: { name: true },
    });

    const payload: DecisionSummaryPayload = {
      generatedAt: new Date().toISOString(),
      snapshotDate: dateStr,
      userId: userId ?? null,
      marketDecision,
      portfolioDecision,
      strategyDecision,
      segmentRecommendation: topSeg,
      avoidSegments: [...new Set([...avoidSegments, ...weakSeg.slice(0, 2)])].filter(
        Boolean,
      ),
      bestCarsToBuy,
      carsToSell,
      riskLevel,
      marketOutlook,
      confidenceScore,
      explanation: '',
      keyFactors,
      warnings,
      opportunities,
      worstScenarioHint: worstScenario?.name ?? 'Market Crash',
      strategyAdvisorNote: strategyAdvice.userRiskNote,
      marketCycleSummary,
    };

    payload.explanation = this.advisorText.buildNarrative(payload);

    let snapshotId: string | null = null;
    if (options?.persist !== false) {
      const row = await this.prisma.decisionSnapshot.upsert({
        where: { snapshotKey },
        create: {
          snapshotKey,
          snapshotDate: today,
          userId: userId ?? null,
          marketDecision,
          portfolioDecision,
          strategyDecision,
          marketCycle: marketCycleSummary,
          marketOutlook,
          riskLevel,
          confidence: confidenceScore,
          summary: payload.explanation,
          keyFactors: keyFactors as unknown as Prisma.InputJsonValue,
          warnings: warnings as unknown as Prisma.InputJsonValue,
          opportunities: opportunities as unknown as Prisma.InputJsonValue,
          details: {
            segmentRecommendation: topSeg,
            avoidSegments: payload.avoidSegments,
            bestCarsToBuy,
            carsToSell,
            strategyAdvisorPrimary: strategyAdvice.primary?.key ?? null,
          } as unknown as Prisma.InputJsonValue,
        },
        update: {
          marketDecision,
          portfolioDecision,
          strategyDecision,
          marketCycle: marketCycleSummary,
          marketOutlook,
          riskLevel,
          confidence: confidenceScore,
          summary: payload.explanation,
          keyFactors: keyFactors as unknown as Prisma.InputJsonValue,
          warnings: warnings as unknown as Prisma.InputJsonValue,
          opportunities: opportunities as unknown as Prisma.InputJsonValue,
          details: {
            segmentRecommendation: topSeg,
            avoidSegments: payload.avoidSegments,
            bestCarsToBuy,
            carsToSell,
            strategyAdvisorPrimary: strategyAdvice.primary?.key ?? null,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      snapshotId = row.id;
    }

    return { ...payload, snapshotId };
  }

  private async pickBuyCandidates(): Promise<DecisionCarHint[]> {
    const cars = await this.prisma.car.findMany({
      where: {
        OR: [
          { marketData: { marketSignal: 'BUY' } },
          { scores: { investmentScore: { gte: 72 } } },
        ],
      },
      include: { scores: true, marketData: true },
      take: 80,
    });
    cars.sort(
      (a, b) =>
        (b.scores?.investmentScore ?? 0) - (a.scores?.investmentScore ?? 0),
    );
    return cars.slice(0, 8).map((c) =>
      toHint(c, 'سیگنال خرید و امتیاز سرمایه‌گذاری بالا'),
    );
  }

  private async pickSellCandidates(
    userId?: string,
  ): Promise<DecisionCarHint[]> {
    const out: DecisionCarHint[] = [];
    const highRisk = await this.prisma.car.findMany({
      where: {
        scores: { riskScore: { gte: 80 } },
        marketData: { marketSignal: 'SELL' },
      },
      include: { scores: true, marketData: true },
      take: 16,
    });
    for (const c of highRisk) {
      out.push(
        toHint(c, 'سیگنال فروش و ریسک بالا'),
      );
    }
    if (userId) {
      const w = await this.prisma.userWatchlist.findMany({
        where: { userId },
        include: {
          car: { include: { marketData: true, scores: true } },
        },
      });
      for (const x of w) {
        if (
          x.car.marketData?.marketSignal === 'SELL' ||
          (x.car.scores?.riskScore ?? 0) > 82
        ) {
          out.push(
            toHint(
              x.car,
              x.car.marketData?.marketSignal === 'SELL'
                ? 'در لیست رصد شما — سیگنال فروش'
                : 'در لیست رصد — ریسک بالا',
            ),
          );
        }
      }
    }
    const seen = new Set<string>();
    return out.filter((c) => {
      if (seen.has(c.carId)) return false;
      seen.add(c.carId);
      return true;
    }).slice(0, 12);
  }

  async getStrategySlice(userId?: string) {
    const advice = await this.strategyAdvisor.recommendStrategy({ userId });
    const strategyDecision = mapStrategyKey(
      advice.primary?.strategy ?? null,
      advice.holdCash,
    );
    return {
      strategyDecision,
      primary: advice.primary,
      ranked: advice.ranked.slice(0, 8),
      holdCash: advice.holdCash,
      holdCashReason: advice.holdCashReason,
      marketSummary: advice.marketSummary,
    };
  }
}

function toHint(
  c: {
    id: string;
    brand: string;
    model: string;
    year: number;
  },
  reason: string,
): DecisionCarHint {
  return {
    carId: c.id,
    brand: c.brand,
    model: c.model,
    year: c.year,
    reason,
  };
}
