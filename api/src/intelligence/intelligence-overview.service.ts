import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RiskLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarketIntelligenceAnalyticsService } from '../analytics/market-intelligence-analytics.service';
import { DecisionEngineService } from '../decision/decision-engine.service';
import { StrategyAdvisorService } from '../portfolio/strategy-advisor.service';
import {
  PortfolioRecommendationService,
  type RiskTolerance,
  type StrategyPreference,
} from '../portfolio/portfolio-recommendation.service';
import { PortfolioAnalyticsService } from '../portfolio/portfolio-analytics.service';
import { PortfolioOptimizationService } from '../portfolio/portfolio-optimization.service';
import { ScenarioAnalyticsService } from '../scenario/scenario-analytics.service';
import { IntelligenceBriefingService } from './intelligence-briefing.service';

function utcDateOnly(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class IntelligenceOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketIntel: MarketIntelligenceAnalyticsService,
    private readonly decision_engine: DecisionEngineService,
    private readonly strategyAdvisor: StrategyAdvisorService,
    private readonly portfolioRecommend: PortfolioRecommendationService,
    private readonly portfolioAnalytics: PortfolioAnalyticsService,
    private readonly optimization: PortfolioOptimizationService,
    private readonly scenarioAnalytics: ScenarioAnalyticsService,
    private readonly briefing: IntelligenceBriefingService,
  ) {}

  getMarketOverview() {
    return this.marketIntel.marketReport();
  }

  async getUserOverview(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        budget: true,
        riskLevel: true,
        usageType: true,
        watchlistCars: { select: { carId: true }, take: 80 },
      },
    });
    if (!u) throw new NotFoundException('کاربر یافت نشد');
    return {
      userId: u.id,
      name: u.name,
      budget: u.budget != null ? Number(u.budget) : null,
      riskLevel: u.riskLevel,
      usageType: u.usageType,
      watchlistSize: u.watchlistCars.length,
      watchlistCarIds: u.watchlistCars.map((w) => w.carId),
    };
  }

  async getPortfolioOverview(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { budget: true, riskLevel: true },
    });
    if (!u) throw new NotFoundException('کاربر یافت نشد');
    const budget = u.budget != null ? Number(u.budget) : 800_000_000;
    const rt = this.mapRiskLevelToTolerance(u.riskLevel);
    const sp = this.mapRiskLevelToStrategyPreference(u.riskLevel);
    return this.portfolioRecommend.recommendPortfolio({
      budget,
      riskTolerance: rt,
      investmentHorizonMonths: 12,
      maxCars: 6,
      strategyPreference: sp,
      userId,
      persist: false,
    });
  }

  getStrategyOverview(userId?: string) {
    return this.strategyAdvisor.recommendStrategy({
      userId: userId?.trim() || undefined,
    });
  }

  getRiskOverview(userId?: string) {
    return this.scenarioAnalytics.portfolioStressSummary(
      userId?.trim() || undefined,
    );
  }

  getOpportunitiesOverview(limit = 28) {
    return this.marketIntel.opportunities({ limit });
  }

  getAlertsOverview(limit = 48) {
    return this.marketIntel.alerts({ limit });
  }

  getDecisionOverview(userId?: string) {
    return this.decision_engine.generateDecisionSummary(
      userId?.trim() || undefined,
      { persist: false },
    );
  }

  async getUnifiedOverview(
    userId?: string,
    opts?: { persist?: boolean },
  ) {
    const today = utcDateOnly(new Date());
    const dateStr = fmtDate(today);
    const snapshotKey = `global:${dateStr}`;

    const [
      marketReport,
      strategy,
      opportunities,
      alertsList,
      decision,
      risk,
      bestCars,
    ] = await Promise.all([
      this.marketIntel.marketReport(),
      this.strategyAdvisor.recommendStrategy({
        userId: userId?.trim() || undefined,
      }),
      this.marketIntel.opportunities({ limit: 24 }),
      this.marketIntel.alerts({ limit: 40 }),
      this.decision_engine.generateDecisionSummary(userId?.trim() || undefined, {
        persist: false,
      }),
      this.scenarioAnalytics.portfolioStressSummary(userId?.trim() || undefined),
      this.getBestCarsSnapshot(12),
    ]);

    const userSlice = userId?.trim()
      ? await this.getUserOverview(userId.trim())
      : null;

    const portfolioSlice = userId?.trim()
      ? await this.getPortfolioOverview(userId.trim())
      : await this.portfolioAnalytics.bestAllocationSample();

    const budgetForOpt =
      userSlice?.budget != null && userSlice.budget > 0
        ? userSlice.budget
        : 800_000_000;

    const bestSh = await this.optimization.bestBySharpe({
      budget: budgetForOpt,
    });

    const bestPortfolio = bestSh.winner
      ? {
          methodology: bestSh.winner.methodology,
          carIds: bestSh.winner.carIds,
          sharpeRatio: bestSh.winner.sharpeRatio,
          expectedReturn: bestSh.winner.expectedReturn,
          expectedVolatility: bestSh.winner.expectedVolatility,
          diversificationScore: bestSh.winner.diversificationScore,
          weightMap: bestSh.winner.weightMap,
        }
      : null;

    const bestStrategy =
      strategy.primary?.title ??
      (strategy.primary?.strategy != null
        ? String(strategy.primary.strategy)
        : decision.strategyDecision);

    const marketOverview = {
      generatedFor: marketReport.generatedFor,
      marketCycle: marketReport.marketCycle?.slice(0, 16),
      segmentTrends: marketReport.segmentTrends,
      volatilityOverview: marketReport.volatilityOverview,
      liquidityOverview: marketReport.liquidityOverview,
      activeAlertsCount: marketReport.activeAlertsCount,
      topRisingCars: marketReport.topRisingCars?.slice(0, 6),
      topFallingCars: marketReport.topFallingCars?.slice(0, 6),
      bestInvestments: marketReport.bestInvestments?.slice(0, 6),
    };

    const briefing = this.briefing.buildUnifiedBriefing({
      decision,
      strategyPrimaryTitle: strategy.primary?.title ?? null,
      activeAlertsCount: marketReport.activeAlertsCount,
    });

    const result = {
      generatedAt: new Date().toISOString(),
      snapshotDate: dateStr,
      briefing,
      briefingEnglish: this.briefing.englishMicroBrief(decision),
      market: marketOverview,
      user: userSlice,
      portfolio: portfolioSlice,
      strategy,
      risk,
      opportunities,
      alerts: alertsList,
      decision,
      bestCars,
      bestPortfolio,
      bestStrategy,
    };

    let intelligenceSnapshotId: string | null = null;
    if (opts?.persist) {
      const row = await this.prisma.intelligenceSnapshot.upsert({
        where: { snapshotKey },
        create: {
          snapshotKey,
          snapshotDate: today,
          marketOverview: marketOverview as unknown as Prisma.InputJsonValue,
          riskOverview: risk as unknown as Prisma.InputJsonValue,
          opportunities: opportunities as unknown as Prisma.InputJsonValue,
          alerts: alertsList as unknown as Prisma.InputJsonValue,
          decision: decision as unknown as Prisma.InputJsonValue,
          bestCars: bestCars as unknown as Prisma.InputJsonValue,
          bestPortfolio: (bestPortfolio ?? {}) as unknown as Prisma.InputJsonValue,
          bestStrategy,
          briefing,
        },
        update: {
          snapshotDate: today,
          marketOverview: marketOverview as unknown as Prisma.InputJsonValue,
          riskOverview: risk as unknown as Prisma.InputJsonValue,
          opportunities: opportunities as unknown as Prisma.InputJsonValue,
          alerts: alertsList as unknown as Prisma.InputJsonValue,
          decision: decision as unknown as Prisma.InputJsonValue,
          bestCars: bestCars as unknown as Prisma.InputJsonValue,
          bestPortfolio: (bestPortfolio ?? {}) as unknown as Prisma.InputJsonValue,
          bestStrategy,
          briefing,
        },
      });
      intelligenceSnapshotId = row.id;
    }

    return { ...result, intelligenceSnapshotId };
  }

  async snapshotHistory(limit = 24) {
    const take = Math.min(Math.max(limit, 1), 80);
    return this.prisma.intelligenceSnapshot.findMany({
      orderBy: { snapshotDate: 'desc' },
      take,
    });
  }

  private async getBestCarsSnapshot(take: number) {
    const n = Math.min(Math.max(take, 3), 24);
    return this.prisma.car.findMany({
      where: { scores: { investmentScore: { not: null } } },
      orderBy: { scores: { investmentScore: 'desc' } },
      take: n,
      select: {
        id: true,
        brand: true,
        model: true,
        year: true,
        segment: true,
        scores: {
          select: {
            investmentScore: true,
            riskScore: true,
          },
        },
      },
    });
  }

  private mapRiskLevelToTolerance(rl: RiskLevel | null): RiskTolerance {
    if (rl === RiskLevel.LOW) return 'LOW';
    if (rl === RiskLevel.HIGH) return 'HIGH';
    return 'MEDIUM';
  }

  private mapRiskLevelToStrategyPreference(
    rl: RiskLevel | null,
  ): StrategyPreference {
    if (rl === RiskLevel.LOW) return 'low-risk';
    if (rl === RiskLevel.HIGH) return 'growth';
    return 'balanced';
  }
}
