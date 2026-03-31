import { Injectable, Logger } from '@nestjs/common';
import {
  LearningHorizon,
  LearningModelFamily,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ModelAnalyticsService } from '../model-evaluation/model-analytics.service';
import {
  AdaptiveWeightService,
  SCOPE_MODEL_SELECTION,
} from './adaptive-weight.service';
import { subCalendarDays, startOfUtcDay } from '../model-evaluation/eval-price.util';

@Injectable()
export class ModelSelectionService {
  private readonly logger = new Logger(ModelSelectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: ModelAnalyticsService,
    private readonly adaptive: AdaptiveWeightService,
  ) {}

  async getSelections(): Promise<Record<string, unknown>> {
    const row = await this.prisma.adaptiveWeights.findUnique({
      where: { scope: SCOPE_MODEL_SELECTION },
    });
    return (row?.weights as Record<string, unknown>) ?? {};
  }

  /** به‌روزرسانی شاخص‌های انتخاب مدل از روی دادهٔ خام و تاریخچه. */
  async refresh(): Promise<Record<string, unknown>> {
    const pred = await this.analytics.predictionPerformance();
    let bestPred: string | null = null;
    let bestMape = Number.POSITIVE_INFINITY;
    for (const row of pred.byModelVersion) {
      if (row.mape != null && row.count >= 5 && row.mape < bestMape) {
        bestMape = row.mape;
        bestPred = row.modelVersion;
      }
    }

    const recSessions = await this.prisma.recommendationSession.groupBy({
      by: ['modelVersion'],
      _count: { id: true },
    });
    const since = subCalendarDays(startOfUtcDay(new Date()), 120);
    const outcomeByVersion = await this.prisma.recommendationOutcome.groupBy({
      by: ['modelVersion'],
      where: {
        horizon: LearningHorizon.D30,
        evaluatedAt: { gte: since },
        modelVersion: { not: null },
        rewardScore: { not: null },
      },
      _avg: { rewardScore: true },
      _count: { id: true },
    });
    let bestRecVer: string | null = null;
    let bestRecReward = Number.NEGATIVE_INFINITY;
    for (const g of outcomeByVersion) {
      if (
        g.modelVersion &&
        g._count.id >= 8 &&
        g._avg.rewardScore != null &&
        g._avg.rewardScore > bestRecReward
      ) {
        bestRecReward = g._avg.rewardScore;
        bestRecVer = g.modelVersion;
      }
    }

    const inv = await this.analytics.investmentPerformance();
    const topDecileSpread =
      inv.deciles?.length >= 2
        ? (inv.deciles[inv.deciles.length - 1]?.avgReturn30d ?? 0) -
          (inv.deciles[0]?.avgReturn30d ?? 0)
        : null;

    const risk = await this.analytics.riskPerformance();
    const optimization = await this.prisma.portfolioOptimizationResult.findMany(
      {
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: { methodology: true, sharpeRatio: true },
      },
    );
    const byMethod = new Map<string, number[]>();
    for (const o of optimization) {
      if (o.sharpeRatio == null) continue;
      const arr = byMethod.get(o.methodology) ?? [];
      arr.push(o.sharpeRatio);
      byMethod.set(o.methodology, arr);
    }
    let bestOptMethod: string | null = null;
    let bestSharpe = Number.NEGATIVE_INFINITY;
    for (const [m, xs] of byMethod) {
      const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
      if (avg > bestSharpe) {
        bestSharpe = avg;
        bestOptMethod = m;
      }
    }

    const stratPick = await this.prisma.strategyOutcome.findFirst({
      orderBy: [{ rewardScore: 'desc' }, { periodEnd: 'desc' }],
    });
    const btBest = await this.prisma.backtestResult.findFirst({
      orderBy: { totalReturn: 'desc' },
      select: { strategyName: true },
    });

    const payload: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      predictionModelVersion: bestPred,
      predictionMapePct: bestPred ? bestMape : null,
      recommendationModelVersion: bestRecVer,
      recommendationAvgRewardD30: bestRecVer ? bestRecReward : null,
      recommendationSessionsByVersion: recSessions.map((r) => ({
        modelVersion: r.modelVersion,
        sessions: r._count.id,
      })),
      investmentScoreDecileSpread30d: topDecileSpread,
      investmentScoreFormula:
        topDecileSpread != null && topDecileSpread > 0.03
          ? 'v1-linear-blend-strong'
          : 'v1-linear-blend',
      riskRankConcordanceVol: risk.rankConcordanceRiskVol,
      riskModelVersion:
        risk.rankConcordanceRiskVol != null &&
        risk.rankConcordanceRiskVol > 0.18
          ? 'v2-tight'
          : 'v2-standard',
      portfolioOptimizationMethod: bestOptMethod,
      portfolioOptimizationAvgSharpe: bestOptMethod ? bestSharpe : null,
      strategyAdvisorStrategy:
        stratPick?.strategyName ?? btBest?.strategyName ?? null,
    };

    await this.adaptive.setModelSelection(
      payload as unknown as Prisma.InputJsonValue,
    );
    this.logger.log('Model selection refreshed');
    return payload;
  }

  async latestHistorySummary() {
    const rows = await this.prisma.modelPerformanceHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 80,
    });
    const byFamily = new Map<LearningModelFamily, typeof rows>();
    for (const r of rows) {
      const arr = byFamily.get(r.modelFamily) ?? [];
      if (arr.length < 12) arr.push(r);
      byFamily.set(r.modelFamily, arr);
    }
    return Object.fromEntries(byFamily);
  }
}
