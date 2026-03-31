import { Injectable } from '@nestjs/common';
import { AdaptiveEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ModelAnalyticsService } from '../model-evaluation/model-analytics.service';
import { AdaptiveRuntimeConfigService } from './adaptive-runtime-config.service';
import {
  ADAPTIVE_NUMERIC_SCOPES,
  DEFAULT_DECISION_CONFIDENCE,
  DEFAULT_RECOMMENDATION_BLEND,
  DEFAULT_SCORING_BLEND,
  DEFAULT_TRIGGER_THRESHOLDS,
} from './adaptive.constants';
import { mergeNumRecord } from './adaptive-merge.util';

@Injectable()
export class AdaptiveAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: AdaptiveRuntimeConfigService,
    private readonly modelAnalytics: ModelAnalyticsService,
  ) {}

  async activeWeights() {
    await this.runtime.ensureSeeds();
    const [
      scoring,
      recommendation,
      triggers,
      decisionConf,
      models,
      controls,
    ] = await Promise.all([
      this.runtime.getScoringWeights(),
      this.runtime.getRecommendationWeights(),
      this.runtime.getTriggerThresholds(),
      this.runtime.getDecisionConfidenceWeights(),
      this.runtime.getSelectedModels(),
      this.prisma.adaptiveControl.findMany(),
    ]);
    return {
      scoring_blend: scoring,
      recommendation_blend: recommendation,
      trigger_thresholds: triggers,
      decision_confidence: decisionConf,
      model_selection: models,
      controls: Object.fromEntries(
        controls.map((c) => [
          c.scope,
          { isFrozen: c.isFrozen, rollbackToVersion: c.rollbackToVersion },
        ]),
      ),
    };
  }

  async versions(scope?: string, take = 80) {
    return this.prisma.adaptiveWeightVersion.findMany({
      where: scope ? { scope } : undefined,
      orderBy: [{ scope: 'asc' }, { version: 'desc' }],
      take: Math.min(take, 500),
    });
  }

  async events(scope?: string, take = 200) {
    return this.prisma.adaptiveEvent.findMany({
      where: scope ? { scope } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 1_000),
    });
  }

  async experiments() {
    const [rows, results] = await Promise.all([
      this.prisma.adaptiveExperiment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 60,
      }),
      this.prisma.adaptiveExperimentResult.findMany({
        orderBy: { createdAt: 'desc' },
        take: 120,
      }),
    ]);
    return { experiments: rows, results };
  }

  async performanceSummary() {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [
      rec,
      rollbacks,
      freezes,
      clamps,
      modelSwitches,
    ] = await Promise.all([
      this.modelAnalytics.recommendationPerformance(),
      this.prisma.adaptiveEvent.count({
        where: {
          eventType: AdaptiveEventType.ROLLBACK,
          createdAt: { gte: since30 },
        },
      }),
      this.prisma.adaptiveEvent.count({
        where: {
          eventType: AdaptiveEventType.FREEZE,
          createdAt: { gte: since30 },
        },
      }),
      this.prisma.adaptiveEvent.count({
        where: {
          eventType: AdaptiveEventType.GUARDRAIL_CLAMPED,
          createdAt: { gte: since30 },
        },
      }),
      this.prisma.adaptiveEvent.count({
        where: {
          eventType: AdaptiveEventType.MODEL_SWITCHED,
          createdAt: { gte: since30 },
        },
      }),
    ]);

    const experimentWinRates = await this.experimentWinRates();
    return {
      recommendationSessions: rec.count,
      recommendationClickRate: rec.clickRate,
      recommendationAvgReturn30d: rec.avgReturn30d,
      rollbacks30d: rollbacks,
      freezes30d: freezes,
      guardrailClamps30d: clamps,
      modelSwitches30d: modelSwitches,
      experimentWinRates,
    };
  }

  async drift(scope?: string, take = 120) {
    const rows = await this.prisma.adaptiveWeightVersion.findMany({
      where: scope ? { scope } : { scope: { in: [...ADAPTIVE_NUMERIC_SCOPES] } },
      orderBy: [{ scope: 'asc' }, { createdAt: 'asc' }],
      take: Math.min(take, 2_000),
      select: { scope: true, version: true, weights: true, createdAt: true },
    });

    const byScope = new Map<
      string,
      Array<{ version: number; weights: unknown; createdAt: Date }>
    >();
    for (const r of rows) {
      const arr = byScope.get(r.scope) ?? [];
      arr.push({ version: r.version, weights: r.weights, createdAt: r.createdAt });
      byScope.set(r.scope, arr);
    }

    const defaultsFor = (sc: string): Record<string, number> => {
      if (sc === 'scoring_blend') return { ...DEFAULT_SCORING_BLEND };
      if (sc === 'recommendation_blend') return { ...DEFAULT_RECOMMENDATION_BLEND };
      if (sc === 'trigger_thresholds') return { ...DEFAULT_TRIGGER_THRESHOLDS };
      if (sc === 'decision_confidence') return { ...DEFAULT_DECISION_CONFIDENCE };
      return {};
    };

    const segments: Array<{
      scope: string;
      fromVersion: number;
      toVersion: number;
      l1Drift: number | null;
      createdAt: Date;
    }> = [];

    for (const [sc, chain] of byScope) {
      const def = defaultsFor(sc);
      for (let i = 1; i < chain.length; i++) {
        const a = mergeNumRecord(def, chain[i - 1]!.weights);
        const b = mergeNumRecord(def, chain[i]!.weights);
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        let l1 = 0;
        for (const k of keys) {
          l1 += Math.abs((a[k] ?? 0) - (b[k] ?? 0));
        }
        segments.push({
          scope: sc,
          fromVersion: chain[i - 1]!.version,
          toVersion: chain[i]!.version,
          l1Drift: Number.isFinite(l1) ? l1 : null,
          createdAt: chain[i]!.createdAt,
        });
      }
    }

    return { segments, versionCount: rows.length };
  }

  async experimentWinRates() {
    const results = await this.prisma.adaptiveExperimentResult.groupBy({
      by: ['winner'],
      where: { winner: { not: null } },
      _count: { id: true },
    });
    return results.map((r) => ({
      winner: r.winner,
      count: r._count.id,
    }));
  }
}
