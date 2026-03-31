import { Injectable, Logger } from '@nestjs/common';
import {
  AdaptiveWeightSource,
  LearningHorizon,
  Prisma,
  TriggerEngineType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { subCalendarDays, startOfUtcDay } from '../model-evaluation/eval-price.util';
import { AdaptiveRuntimeConfigService } from '../adaptive/adaptive-runtime-config.service';
import { AdaptiveGuardrailService } from '../adaptive/adaptive-guardrail.service';
import { AdaptiveVersioningService } from '../adaptive/adaptive-versioning.service';
import { thresholdForTriggerType as trigThreshold } from '../adaptive/adaptive-trigger.util';
import {
  DEFAULT_DECISION_CONFIDENCE,
  DEFAULT_RECOMMENDATION_BLEND,
  DEFAULT_SCORING_BLEND,
  DEFAULT_TRIGGER_THRESHOLDS,
  SCOPE_DECISION_CONFIDENCE,
  SCOPE_MODEL_SELECTION,
  SCOPE_RECOMMENDATION_BLEND,
  SCOPE_SCORING_BLEND,
  SCOPE_TRIGGER_THRESHOLDS,
} from '../adaptive/adaptive.constants';

export {
  DEFAULT_DECISION_CONFIDENCE,
  DEFAULT_RECOMMENDATION_BLEND,
  DEFAULT_SCORING_BLEND,
  DEFAULT_TRIGGER_THRESHOLDS,
  SCOPE_DECISION_CONFIDENCE,
  SCOPE_MODEL_SELECTION,
  SCOPE_RECOMMENDATION_BLEND,
  SCOPE_SCORING_BLEND,
  SCOPE_TRIGGER_THRESHOLDS,
} from '../adaptive/adaptive.constants';

function clampWeight(v: number): number {
  return Math.min(1.35, Math.max(0.65, v));
}

@Injectable()
export class AdaptiveWeightService {
  private readonly logger = new Logger(AdaptiveWeightService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: AdaptiveRuntimeConfigService,
    private readonly guardrail: AdaptiveGuardrailService,
    private readonly versioning: AdaptiveVersioningService,
  ) {}

  async getWeights(scope: string): Promise<Record<string, number>> {
    await this.ensureSeedScopes();
    return this.runtime.resolveNumericByScope(scope);
  }

  async getModelSelectionPayload(): Promise<Record<string, unknown>> {
    await this.ensureSeedScopes();
    return this.runtime.getSelectedModels();
  }

  thresholdForTriggerType(
    adaptive: Record<string, number>,
    type: TriggerEngineType,
    fallback: number,
  ): number {
    return trigThreshold(adaptive, type, fallback);
  }

  async ensureSeedScopes(): Promise<void> {
    await this.runtime.ensureSeeds();
  }

  private async persistNumeric(
    scope: string,
    proposed: Record<string, number>,
    source: AdaptiveWeightSource,
    note: string | null,
  ): Promise<{ skipped: boolean; version: number }> {
    const previous = await this.runtime.resolveNumericByScope(scope);
    const gr = this.guardrail.clampNumericScope(scope, proposed, previous);
    return this.versioning.persistNumericUpdate(
      scope,
      gr.weights,
      previous,
      source,
      note,
      { clamped: gr.clamped, warnings: gr.warnings },
    );
  }

  async evolveScoringBlend(): Promise<{ scoringVersion: number }> {
    await this.ensureSeedScopes();
    const current = await this.getWeights(SCOPE_SCORING_BLEND);
    const next = { ...DEFAULT_SCORING_BLEND, ...current };

    const since = subCalendarDays(startOfUtcDay(new Date()), 90);

    const [recAgg, decAgg, calib] = await Promise.all([
      this.prisma.recommendationOutcome.aggregate({
        where: {
          horizon: LearningHorizon.D30,
          evaluatedAt: { gte: since },
          rewardScore: { not: null },
        },
        _avg: { rewardScore: true },
      }),
      this.prisma.decisionOutcome.aggregate({
        where: {
          horizon: LearningHorizon.D30,
          evaluatedAt: { gte: since },
          success: { not: null },
        },
        _avg: { rewardScore: true },
      }),
      this.prisma.scoreCalibration.findMany({
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
    ]);

    const rBar = recAgg._avg.rewardScore;
    if (rBar != null) {
      if (rBar > 8) next.investment = clampWeight((next.investment ?? 1) + 0.03);
      if (rBar < -5) next.investment = clampWeight((next.investment ?? 1) - 0.03);
      if (rBar > 5) next.momentum = clampWeight((next.momentum ?? 1) + 0.02);
      if (rBar < -4) next.momentum = clampWeight((next.momentum ?? 1) - 0.02);
    }

    const dBar = decAgg._avg.rewardScore;
    if (dBar != null) {
      if (dBar > 5) next.market = clampWeight((next.market ?? 1) + 0.02);
      if (dBar < -4) next.risk = clampWeight((next.risk ?? 1) + 0.025);
    }

    for (const c of calib) {
      const p = c.parameter.toLowerCase();
      if (p.includes('risk') && (c.newWeight ?? 0) < (c.oldWeight ?? 0)) {
        next.risk = clampWeight((next.risk ?? 1) + 0.015);
      }
      if (p.includes('invest') && (c.newWeight ?? 0) > (c.oldWeight ?? 0)) {
        next.investment = clampWeight((next.investment ?? 1) + 0.015);
      }
    }

    const note = `evolve recAvg=${rBar?.toFixed(2) ?? 'na'} decAvg=${dBar?.toFixed(2) ?? 'na'}`;
    const result = await this.persistNumeric(
      SCOPE_SCORING_BLEND,
      next,
      AdaptiveWeightSource.LEARNING,
      note,
    );

    const row = await this.prisma.adaptiveWeights.findUnique({
      where: { scope: SCOPE_SCORING_BLEND },
    });
    const scoringVersion = result.skipped
      ? row?.version ?? 0
      : result.version;
    this.logger.log(`Adaptive scoring_blend v${scoringVersion}`);
    return { scoringVersion };
  }

  async evolveRecommendationBlend(): Promise<void> {
    const cur = await this.getWeights(SCOPE_RECOMMENDATION_BLEND);
    const next = { ...DEFAULT_RECOMMENDATION_BLEND, ...cur };
    const since = subCalendarDays(startOfUtcDay(new Date()), 90);
    const agg = await this.prisma.recommendationOutcome.aggregate({
      where: {
        horizon: LearningHorizon.D30,
        evaluatedAt: { gte: since },
        rewardScore: { not: null },
      },
      _avg: { rewardScore: true },
    });
    const r = agg._avg.rewardScore;
    if (r != null) {
      if (r > 10) {
        next.investmentScore = Math.min(0.22, next.investmentScore + 0.015);
        next.baseScore = Math.max(0.25, next.baseScore - 0.01);
      } else if (r < -3) {
        next.marketScore = Math.min(0.28, next.marketScore + 0.015);
        next.behaviorScore = Math.min(0.22, next.behaviorScore + 0.01);
      }
    }
    const sum =
      next.baseScore +
      next.marketScore +
      next.behaviorScore +
      next.personalizationScore +
      next.investmentScore;
    if (sum > 1e-9 && Math.abs(sum - 1) > 0.02) {
      const k = 1 / sum;
      next.baseScore *= k;
      next.marketScore *= k;
      next.behaviorScore *= k;
      next.personalizationScore *= k;
      next.investmentScore *= k;
    }
    await this.persistNumeric(
      SCOPE_RECOMMENDATION_BLEND,
      next,
      AdaptiveWeightSource.LEARNING,
      'evolve from recommendation outcomes',
    );
  }

  async evolveTriggerThresholds(): Promise<void> {
    const cur = await this.getWeights(SCOPE_TRIGGER_THRESHOLDS);
    const next = { ...DEFAULT_TRIGGER_THRESHOLDS, ...cur };
    const since = subCalendarDays(startOfUtcDay(new Date()), 14);
    const recent = await this.prisma.triggerEvent.count({
      where: { createdAt: { gte: since } },
    });
    if (recent > 800) {
      next.price_drop_pct = Math.min(0.14, next.price_drop_pct + 0.008);
      next.volatility_spike = Math.min(90, next.volatility_spike + 2);
    } else if (recent < 80) {
      next.price_drop_pct = Math.max(0.04, next.price_drop_pct - 0.004);
    }
    await this.persistNumeric(
      SCOPE_TRIGGER_THRESHOLDS,
      next,
      AdaptiveWeightSource.LEARNING,
      `events14d=${recent}`,
    );
  }

  async evolveDecisionConfidence(): Promise<void> {
    const cur = await this.getWeights(SCOPE_DECISION_CONFIDENCE);
    const next = { ...DEFAULT_DECISION_CONFIDENCE, ...cur };
    const since = subCalendarDays(startOfUtcDay(new Date()), 90);
    const outcomes = await this.prisma.decisionOutcome.findMany({
      where: {
        horizon: LearningHorizon.D30,
        evaluatedAt: { gte: since },
        success: { not: null },
      },
      select: { success: true },
    });
    if (outcomes.length >= 15) {
      const win = outcomes.filter((o) => o.success).length / outcomes.length;
      if (win < 0.42) next.scale = Math.max(0.82, next.scale - 0.03);
      else if (win > 0.58) next.scale = Math.min(1.12, next.scale + 0.02);
    }
    await this.persistNumeric(
      SCOPE_DECISION_CONFIDENCE,
      next,
      AdaptiveWeightSource.LEARNING,
      'evolve from decision outcomes',
    );
  }

  async evolveFullAdaptiveLoop(): Promise<void> {
    await this.evolveRecommendationBlend();
    await this.evolveTriggerThresholds();
    await this.evolveDecisionConfidence();
  }

  async setModelSelection(weights: Prisma.InputJsonValue, note?: string) {
    await this.ensureSeedScopes();
    const prev = await this.runtime.getSelectedModels();
    const patch =
      weights &&
      typeof weights === 'object' &&
      !Array.isArray(weights)
        ? (weights as Record<string, unknown>)
        : {};
    const proposed = { ...prev, ...patch };
    const gr = this.guardrail.clampModelSelectionPayload(proposed, prev);
    await this.versioning.persistJsonUpdate(
      SCOPE_MODEL_SELECTION,
      gr.payload,
      prev,
      AdaptiveWeightSource.LEARNING,
      note ?? 'model selection refresh',
      { clamped: gr.clamped, warnings: gr.warnings },
    );
  }

  async evolve(): Promise<{ scoringVersion: number }> {
    return this.evolveScoringBlend();
  }
}
