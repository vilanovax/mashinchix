import { Injectable } from '@nestjs/common';
import { AdaptiveExperimentStatus, TriggerEngineType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ADAPTIVE_SEED_ROWS,
  DEFAULT_DECISION_CONFIDENCE,
  DEFAULT_RECOMMENDATION_BLEND,
  DEFAULT_SCORING_BLEND,
  DEFAULT_TRIGGER_THRESHOLDS,
  SCOPE_DECISION_CONFIDENCE,
  SCOPE_MODEL_SELECTION,
  SCOPE_RECOMMENDATION_BLEND,
  SCOPE_SCORING_BLEND,
  SCOPE_TRIGGER_THRESHOLDS,
} from './adaptive.constants';
import { mergeNumRecord } from './adaptive-merge.util';
import { thresholdForTriggerType as trigThreshold } from './adaptive-trigger.util';

@Injectable()
export class AdaptiveRuntimeConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureSeeds(): Promise<void> {
    for (const s of ADAPTIVE_SEED_ROWS) {
      await this.prisma.adaptiveWeights.upsert({
        where: { scope: s.scope },
        create: { scope: s.scope, weights: s.weights, note: s.note },
        update: {},
      });
    }
  }

  private async rawWeightsForScope(scope: string): Promise<unknown> {
    const [active, row] = await Promise.all([
      this.prisma.adaptiveWeightVersion.findFirst({
        where: { scope, isActive: true },
        orderBy: { version: 'desc' },
      }),
      this.prisma.adaptiveWeights.findUnique({ where: { scope } }),
    ]);
    return active?.weights ?? row?.weights;
  }

  async resolveNumericByScope(scope: string): Promise<Record<string, number>> {
    await this.ensureSeeds();
    const raw = await this.rawWeightsForScope(scope);
    if (scope === SCOPE_SCORING_BLEND) {
      return mergeNumRecord(DEFAULT_SCORING_BLEND, raw);
    }
    if (scope === SCOPE_RECOMMENDATION_BLEND) {
      return mergeNumRecord(DEFAULT_RECOMMENDATION_BLEND, raw);
    }
    if (scope === SCOPE_TRIGGER_THRESHOLDS) {
      return mergeNumRecord(DEFAULT_TRIGGER_THRESHOLDS, raw);
    }
    if (scope === SCOPE_DECISION_CONFIDENCE) {
      return mergeNumRecord(DEFAULT_DECISION_CONFIDENCE, raw);
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return raw as Record<string, number>;
  }

  async getScoringWeights(): Promise<Record<string, number>> {
    return this.resolveNumericByScope(SCOPE_SCORING_BLEND);
  }

  async getRecommendationWeights(): Promise<Record<string, number>> {
    return this.resolveNumericByScope(SCOPE_RECOMMENDATION_BLEND);
  }

  async getTriggerThresholds(): Promise<Record<string, number>> {
    return this.resolveNumericByScope(SCOPE_TRIGGER_THRESHOLDS);
  }

  async getDecisionConfidenceWeights(): Promise<Record<string, number>> {
    return this.resolveNumericByScope(SCOPE_DECISION_CONFIDENCE);
  }

  async getSelectedModels(): Promise<Record<string, unknown>> {
    await this.ensureSeeds();
    const raw = await this.rawWeightsForScope(SCOPE_MODEL_SELECTION);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }
    return raw as Record<string, unknown>;
  }

  thresholdForTriggerType(
    adaptive: Record<string, number>,
    type: TriggerEngineType,
    fallback: number,
  ): number {
    return trigThreshold(adaptive, type, fallback);
  }

  /** آزمایش فعال (سایه) برای scope — بدون مسیریابی ترافیک */
  async activeExperimentForScope(scope: string) {
    return this.prisma.adaptiveExperiment.findFirst({
      where: { scope, status: AdaptiveExperimentStatus.RUNNING },
      orderBy: { createdAt: 'desc' },
    });
  }

  async experimentAssignments(scope: string): Promise<{
    experiment: { id: string; name: string; trafficSplit: number } | null;
    controlVersion: number | null;
    candidateVersion: number | null;
  }> {
    const exp = await this.activeExperimentForScope(scope);
    if (!exp) {
      return {
        experiment: null,
        controlVersion: null,
        candidateVersion: null,
      };
    }
    return {
      experiment: {
        id: exp.id,
        name: exp.name,
        trafficSplit: exp.trafficSplit,
      },
      controlVersion: exp.controlVersion,
      candidateVersion: exp.candidateVersion,
    };
  }
}
