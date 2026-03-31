import { Injectable, Logger } from '@nestjs/common';
import {
  AdaptiveEventType,
  AdaptiveWeightSource,
  LearningHorizon,
  LearningModelFamily,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ModelAnalyticsService } from '../model-evaluation/model-analytics.service';
import { AdaptiveGuardrailService } from './adaptive-guardrail.service';
import { AdaptiveVersioningService } from './adaptive-versioning.service';
import {
  DEFAULT_TRIGGER_THRESHOLDS,
  SCOPE_DECISION_CONFIDENCE,
  SCOPE_RECOMMENDATION_BLEND,
  SCOPE_TRIGGER_THRESHOLDS,
} from './adaptive.constants';
import { subCalendarDays, startOfUtcDay } from '../model-evaluation/eval-price.util';
import { mergeNumRecord, nearlyEqualRecord } from './adaptive-merge.util';

@Injectable()
export class AdaptivePerformanceGateService {
  private readonly logger = new Logger(AdaptivePerformanceGateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: ModelAnalyticsService,
    private readonly guardrail: AdaptiveGuardrailService,
    private readonly versioning: AdaptiveVersioningService,
  ) {}

  async evaluateAfterRecompute(): Promise<{
    recommendationRolledBack: boolean;
    predictionPromotionBlocked: boolean;
    triggerThresholdsClamped: boolean;
    decisionConfidenceFrozen: boolean;
  }> {
    const result = {
      recommendationRolledBack: false,
      predictionPromotionBlocked: false,
      triggerThresholdsClamped: false,
      decisionConfidenceFrozen: false,
    };

    const roAgg = await this.prisma.recommendationOutcome.aggregate({
      where: {
        horizon: LearningHorizon.D30,
        evaluatedAt: { gte: subCalendarDays(startOfUtcDay(new Date()), 45) },
      },
      _avg: { rewardScore: true },
      _count: { id: true },
    });
    if (roAgg._count.id >= 12 && (roAgg._avg.rewardScore ?? 0) < -12) {
      const did = await this.versioning.rollbackToPreviousNumericVersion(
        SCOPE_RECOMMENDATION_BLEND,
        'performance gate: recommendation reward collapsed',
      );
      result.recommendationRolledBack = did;
    }

    const recentPred = await this.prisma.modelPerformanceHistory.findMany({
      where: {
        modelFamily: LearningModelFamily.PREDICTION,
        metricName: 'mape_pct',
      },
      orderBy: { periodEnd: 'desc' },
      take: 6,
    });
    if (recentPred.length >= 2) {
      const a = recentPred[0]!.metricValue;
      const b = recentPred[1]!.metricValue;
      if (a > b * 1.25 && b > 1e-6) {
        await this.versioning.logEvent({
          scope: 'prediction_model',
          eventType: AdaptiveEventType.MODEL_SWITCHED,
          reason: 'performance gate: prediction MAPE worsened — promotion blocked',
          metadata: {
            recentMape: a,
            priorMape: b,
            blockedPromotion: true,
          } as unknown as Prisma.InputJsonValue,
        });
        result.predictionPromotionBlocked = true;
      }
    }

    const since = subCalendarDays(startOfUtcDay(new Date()), 14);
    const trig14 = await this.prisma.triggerEvent.count({
      where: { createdAt: { gte: since } },
    });
    const priorStart = subCalendarDays(startOfUtcDay(new Date()), 28);
    const trigPrior = await this.prisma.triggerEvent.count({
      where: {
        createdAt: { gte: priorStart, lt: since },
      },
    });
    if (trigPrior > 50 && trig14 > trigPrior * 2.2) {
      const row = await this.prisma.adaptiveWeights.findUnique({
        where: { scope: SCOPE_TRIGGER_THRESHOLDS },
      });
      const prev = mergeNumRecord(DEFAULT_TRIGGER_THRESHOLDS, row?.weights);
      const proposed = { ...prev };
      proposed.price_drop_pct = Math.min(0.12, prev.price_drop_pct + 0.01);
      proposed.volatility_spike = Math.min(88, prev.volatility_spike + 3);
      const gr = this.guardrail.clampNumericScope(
        SCOPE_TRIGGER_THRESHOLDS,
        proposed,
        prev,
      );
      if (!nearlyEqualRecord(gr.weights, prev)) {
        await this.versioning.persistNumericUpdate(
          SCOPE_TRIGGER_THRESHOLDS,
          gr.weights,
          prev,
          AdaptiveWeightSource.MANUAL,
          'performance gate: trigger volume spike — less aggressive thresholds',
          {
            clamped: gr.clamped,
            warnings: [...gr.warnings, 'gate-trigger-volume'],
          },
        );
        result.triggerThresholdsClamped = true;
      }
    }

    const dec = await this.prisma.decisionOutcome.findMany({
      where: {
        horizon: LearningHorizon.D30,
        evaluatedAt: { gte: subCalendarDays(startOfUtcDay(new Date()), 90) },
        success: { not: null },
      },
      select: { success: true },
    });
    if (dec.length >= 20) {
      const win = dec.filter((d) => d.success).length / dec.length;
      if (win < 0.33) {
        await this.versioning.freeze(
          SCOPE_DECISION_CONFIDENCE,
          'performance gate: decision success rate low',
        );
        result.decisionConfidenceFrozen = true;
      }
    }

    const rec = await this.analytics.recommendationPerformance();
    if (rec.count >= 30 && rec.avgReturn30d != null && rec.avgReturn30d < -0.08) {
      this.logger.warn(
        `Adaptive gate: recommendation avgReturn30d=${rec.avgReturn30d}`,
      );
    }

    return result;
  }
}
