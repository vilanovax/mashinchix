import { Injectable, Logger } from '@nestjs/common';
import {
  LearningModelFamily,
  LearningHorizon,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ModelAnalyticsService } from '../model-evaluation/model-analytics.service';
import { LearningOutcomeService } from './learning-outcome.service';
import { AdaptiveWeightService } from './adaptive-weight.service';
import { ModelSelectionService } from './model-selection.service';
import { AdaptivePerformanceGateService } from '../adaptive/adaptive-performance-gate.service';
import { subCalendarDays, startOfUtcDay } from '../model-evaluation/eval-price.util';
import { mean } from '../model-evaluation/eval-math.util';

@Injectable()
export class LearningEngineService {
  private readonly logger = new Logger(LearningEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: ModelAnalyticsService,
    private readonly outcomes: LearningOutcomeService,
    private readonly adaptive: AdaptiveWeightService,
    private readonly selection: ModelSelectionService,
    private readonly adaptivePerformanceGate: AdaptivePerformanceGateService,
  ) {}

  async recompute(options?: {
    skipOutcomes?: boolean;
    maxRecommendationRows?: number;
  }): Promise<{
    outcomes: Record<string, number>;
    historyRows: number;
    weights: { scoringVersion: number };
    selection: Record<string, unknown>;
    adaptiveGate: {
      recommendationRolledBack: boolean;
      predictionPromotionBlocked: boolean;
      triggerThresholdsClamped: boolean;
      decisionConfidenceFrozen: boolean;
    };
  }> {
    const outcomeSummary: Record<string, number> = {};

    if (!options?.skipOutcomes) {
      const r1 = await this.outcomes.syncRecommendationOutcomes(
        options?.maxRecommendationRows ?? 600,
      );
      outcomeSummary.recommendationOutcomes = r1.created;
      const r2 = await this.outcomes.syncDecisionOutcomes(120);
      outcomeSummary.decisionOutcomes = r2.created;
      const r3 = await this.outcomes.syncPortfolioOutcomes(100);
      outcomeSummary.portfolioOutcomes = r3.created;
      const r4 = await this.outcomes.syncStrategyOutcomes();
      outcomeSummary.strategyOutcomes = r4.upserted;
      const r5 = await this.outcomes.syncSignalPerformance();
      outcomeSummary.signalPerformance = r5.upserted;
    }

    const historyRows = await this.persistModelPerformanceHistory();
    const weights = await this.adaptive.evolveScoringBlend();
    const selection = await this.selection.refresh();
    await this.adaptive.evolveFullAdaptiveLoop();
    const gate = await this.adaptivePerformanceGate.evaluateAfterRecompute();

    this.logger.log(
      `Learning recompute done: history+${historyRows}, weights v${weights.scoringVersion}, gate=${JSON.stringify(gate)}`,
    );

    return {
      outcomes: outcomeSummary,
      historyRows,
      weights,
      selection,
      adaptiveGate: gate,
    };
  }

  private async persistModelPerformanceHistory(): Promise<number> {
    const periodEnd = startOfUtcDay(new Date());
    const periodStart = subCalendarDays(periodEnd, 90);
    const rows: Prisma.ModelPerformanceHistoryCreateManyInput[] = [];

    const pred = await this.analytics.predictionPerformance();
    for (const p of pred.byModelVersion) {
      if (p.count < 3) continue;
      if (p.mape != null) {
        rows.push({
          modelFamily: LearningModelFamily.PREDICTION,
          modelKey: p.modelVersion,
          metricName: 'mape_pct',
          metricValue: p.mape,
          sampleSize: p.count,
          periodStart,
          periodEnd,
          metadata: { mae: p.mae, rmse: p.rmse } as Prisma.InputJsonValue,
        });
      }
    }

    const inv = await this.analytics.investmentPerformance();
    if (inv.sampleSize >= 10 && inv.deciles?.length) {
      const spread =
        (inv.deciles[inv.deciles.length - 1]?.avgReturn30d ?? 0) -
        (inv.deciles[0]?.avgReturn30d ?? 0);
      rows.push({
        modelFamily: LearningModelFamily.INVESTMENT_SCORE,
        modelKey: 'decile_spread_30d',
        metricName: 'top_minus_bottom_decile_return',
        metricValue: spread,
        sampleSize: inv.sampleSize,
        periodStart,
        periodEnd,
      });
    }

    const risk = await this.analytics.riskPerformance();
    if (risk.rankConcordanceRiskVol != null) {
      rows.push({
        modelFamily: LearningModelFamily.RISK_SCORE,
        modelKey: 'correlation_proxy',
        metricName: 'rank_concordance_risk_vs_future_vol',
        metricValue: risk.rankConcordanceRiskVol,
        sampleSize: risk.sampleSize,
        periodStart,
        periodEnd,
      });
    }

    const rec = await this.analytics.recommendationPerformance();
    rows.push({
      modelFamily: LearningModelFamily.RECOMMENDATION,
      modelKey: 'aggregate',
      metricName: 'click_rate',
      metricValue: rec.clickRate,
      sampleSize: rec.count,
      periodStart,
      periodEnd,
    });
    rows.push({
      modelFamily: LearningModelFamily.RECOMMENDATION,
      modelKey: 'aggregate',
      metricName: 'save_rate',
      metricValue: rec.saveRate,
      sampleSize: rec.count,
      periodStart,
      periodEnd,
    });
    if (rec.avgReturn30d != null) {
      rows.push({
        modelFamily: LearningModelFamily.RECOMMENDATION,
        modelKey: 'aggregate',
        metricName: 'avg_session_return_30d',
        metricValue: rec.avgReturn30d,
        sampleSize: rec.count,
        periodStart,
        periodEnd,
      });
    }

    const roAgg = await this.prisma.recommendationOutcome.aggregate({
      where: {
        horizon: LearningHorizon.D30,
        evaluatedAt: { gte: periodStart },
      },
      _avg: { rewardScore: true, returnPct: true },
      _count: { id: true },
    });
    if (roAgg._count.id > 0) {
      rows.push({
        modelFamily: LearningModelFamily.RECOMMENDATION,
        modelKey: 'outcome_d30',
        metricName: 'avg_reward',
        metricValue: roAgg._avg.rewardScore ?? 0,
        sampleSize: roAgg._count.id,
        periodStart,
        periodEnd,
      });
    }

    const trigCounts = await this.prisma.triggerEvent.groupBy({
      by: ['type'],
      where: { createdAt: { gte: periodStart } },
      _count: { id: true },
    });
    for (const t of trigCounts) {
      rows.push({
        modelFamily: LearningModelFamily.TRIGGER,
        modelKey: t.type,
        metricName: 'event_count_90d',
        metricValue: t._count.id,
        sampleSize: t._count.id,
        periodStart,
        periodEnd,
      });
    }

    const graphCounts = await this.prisma.carRelationship.count({
      where: { createdAt: { gte: periodStart } },
    });
    rows.push({
      modelFamily: LearningModelFamily.GRAPH,
      modelKey: 'car_relationship',
      metricName: 'new_edges_90d',
      metricValue: graphCounts,
      sampleSize: graphCounts,
      periodStart,
      periodEnd,
    });

    const opt = await this.prisma.portfolioOptimizationResult.findMany({
      where: { createdAt: { gte: periodStart } },
      select: { sharpeRatio: true, expectedReturn: true, expectedVolatility: true },
    });
    if (opt.length) {
      const sharpes = opt
        .map((o) => o.sharpeRatio)
        .filter((x): x is number => x != null);
      rows.push({
        modelFamily: LearningModelFamily.OPTIMIZATION,
        modelKey: 'frontier_batch',
        metricName: 'mean_sharpe',
        metricValue: sharpes.length ? mean(sharpes) : 0,
        sampleSize: opt.length,
        periodStart,
        periodEnd,
      });
    }

    if (rows.length) {
      await this.prisma.modelPerformanceHistory.createMany({ data: rows });
    }
    return rows.length;
  }

  async summary() {
    const [historyFamilies, triggers] = await Promise.all([
      this.selection.latestHistorySummary(),
      this.prisma.triggerEvent.groupBy({
        by: ['type'],
        _count: { id: true },
        where: {
          createdAt: {
            gte: subCalendarDays(startOfUtcDay(new Date()), 30),
          },
        },
      }),
    ]);
    return {
      modelPerformanceByFamily: historyFamilies,
      triggerVolume30d: triggers.map((t) => ({
        type: t.type,
        count: t._count.id,
      })),
    };
  }
}
