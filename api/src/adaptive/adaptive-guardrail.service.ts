import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OPT_METHODOLOGIES } from '../portfolio/dto/portfolio-optimize.dto';
import {
  SCOPE_DECISION_CONFIDENCE,
  SCOPE_MODEL_SELECTION,
  SCOPE_RECOMMENDATION_BLEND,
  SCOPE_SCORING_BLEND,
  SCOPE_TRIGGER_THRESHOLDS,
} from './adaptive.constants';
import { nearlyEqualRecord } from './adaptive-merge.util';

export type GuardrailNumericResult = {
  weights: Record<string, number>;
  clamped: boolean;
  warnings: string[];
};

@Injectable()
export class AdaptiveGuardrailService {
  private readonly maxRelDelta: number;

  constructor(private readonly config: ConfigService) {
    this.maxRelDelta = Number(
      this.config.get<string>('ADAPTIVE_MAX_RELATIVE_DELTA', '0.15'),
    );
  }

  clampNumericScope(
    scope: string,
    proposed: Record<string, number>,
    previous: Record<string, number>,
  ): GuardrailNumericResult {
    const warnings: string[] = [];
    let clamped = false;
    const out: Record<string, number> = { ...proposed };
    const keys = new Set([...Object.keys(previous), ...Object.keys(out)]);

    const maxDelta = Number.isFinite(this.maxRelDelta) ? this.maxRelDelta : 0.15;

    for (const k of keys) {
      const prev = previous[k];
      const next = out[k];
      if (next === undefined) continue;
      if (!Number.isFinite(next)) {
        out[k] = prev ?? 0;
        clamped = true;
        warnings.push(`non-finite:${k}`);
        continue;
      }
      if (prev != null && Number.isFinite(prev) && Math.abs(prev) > 1e-12) {
        const rel = Math.abs(next - prev) / Math.abs(prev);
        if (rel > maxDelta) {
          const step = Math.sign(next - prev) * Math.abs(prev) * maxDelta;
          out[k] = prev + step;
          clamped = true;
          warnings.push(`rel-cap:${k}`);
        }
      }
    }

    this.applyAbsoluteBounds(scope, out, warnings, () => {
      clamped = true;
    });

    if (scope === SCOPE_SCORING_BLEND) {
      for (const k of Object.keys(out)) {
        const lk = k.toLowerCase();
        if (lk === 'risk' || lk.startsWith('risk_')) {
          const floor = 0.65;
          if (out[k]! < floor) {
            out[k] = floor;
            clamped = true;
            warnings.push(`risk-floor:${k}`);
          }
        }
      }
    }

    if (
      scope === SCOPE_RECOMMENDATION_BLEND &&
      !nearlyEqualRecord(out, previous, 1e-9)
    ) {
      const sum =
        (out.baseScore ?? 0) +
        (out.marketScore ?? 0) +
        (out.behaviorScore ?? 0) +
        (out.personalizationScore ?? 0) +
        (out.investmentScore ?? 0);
      if (sum > 1e-9 && Math.abs(sum - 1) > 0.02) {
        const k = 1 / sum;
        out.baseScore = (out.baseScore ?? 0) * k;
        out.marketScore = (out.marketScore ?? 0) * k;
        out.behaviorScore = (out.behaviorScore ?? 0) * k;
        out.personalizationScore = (out.personalizationScore ?? 0) * k;
        out.investmentScore = (out.investmentScore ?? 0) * k;
        warnings.push('recommendation-blend-renorm');
        clamped = true;
      }
    }

    return { weights: out, clamped, warnings };
  }

  private applyAbsoluteBounds(
    scope: string,
    out: Record<string, number>,
    warnings: string[],
    markClamped: () => void,
  ) {
    const clamp = (k: string, lo: number, hi: number) => {
      const v = out[k];
      if (v === undefined || !Number.isFinite(v)) return;
      if (v < lo) {
        out[k] = lo;
        warnings.push(`min:${k}`);
        markClamped();
      } else if (v > hi) {
        out[k] = hi;
        warnings.push(`max:${k}`);
        markClamped();
      }
    };

    if (scope === SCOPE_SCORING_BLEND) {
      for (const k of Object.keys(out)) {
        clamp(k, 0.65, 1.35);
      }
    }
    if (scope === SCOPE_RECOMMENDATION_BLEND) {
      clamp('baseScore', 0.05, 0.55);
      clamp('marketScore', 0.05, 0.4);
      clamp('behaviorScore', 0.05, 0.35);
      clamp('personalizationScore', 0.05, 0.35);
      clamp('investmentScore', 0.02, 0.28);
      clamp('riskPenalty', 0.5, 1.5);
      clamp('momentum', 0, 0.25);
      clamp('liquidity', 0, 0.25);
    }
    if (scope === SCOPE_TRIGGER_THRESHOLDS) {
      clamp('price_drop_pct', 0.03, 0.18);
      clamp('price_spike', 0.03, 0.22);
      clamp('volatility_spike', 52, 95);
      clamp('liquidity_drop', 18, 55);
      clamp('demand_spike', 45, 90);
      clamp('portfolio_drift_pct', 0.06, 0.28);
      clamp('risk_increase_threshold', 52, 88);
      clamp('segment_rotation_pct', 0.02, 0.12);
    }
    if (scope === SCOPE_DECISION_CONFIDENCE) {
      clamp('base', 35, 72);
      clamp('mapeSensitivity', 72, 200);
      clamp('regimeSensitivity', 10, 45);
      clamp('volHighPenalty', 4, 24);
      clamp('volLowBoost', 0, 16);
      clamp('buySignalBoost', 0, 14);
      clamp('momHighBoost', 0, 14);
      clamp('momLowPenalty', 0, 14);
      clamp('stressPenalty', 3, 22);
      clamp('scale', 0.75, 1.15);
    }
  }

  clampModelSelectionPayload(
    proposed: Record<string, unknown>,
    previous: Record<string, unknown>,
  ): { payload: Record<string, unknown>; clamped: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let clamped = false;
    const out: Record<string, unknown> = {
      ...previous,
      ...proposed,
    };

    const m = out.portfolioOptimizationMethod;
    if (m != null) {
      if (
        typeof m !== 'string' ||
        !(OPT_METHODOLOGIES as readonly string[]).includes(m)
      ) {
        if (
          typeof previous.portfolioOptimizationMethod === 'string' &&
          (OPT_METHODOLOGIES as readonly string[]).includes(
            previous.portfolioOptimizationMethod,
          )
        ) {
          out.portfolioOptimizationMethod = previous.portfolioOptimizationMethod;
        } else {
          delete out.portfolioOptimizationMethod;
        }
        clamped = true;
        warnings.push('portfolioOptimizationMethod-invalid');
      }
    }

    const allowKeys = new Set([
      'updatedAt',
      'predictionModelVersion',
      'predictionMapePct',
      'recommendationModelVersion',
      'recommendationAvgRewardD30',
      'recommendationSessionsByVersion',
      'investmentScoreDecileSpread30d',
      'investmentScoreFormula',
      'riskRankConcordanceVol',
      'riskModelVersion',
      'portfolioOptimizationMethod',
      'portfolioOptimizationAvgSharpe',
      'strategyAdvisorStrategy',
    ]);
    for (const k of Object.keys(out)) {
      if (!allowKeys.has(k)) {
        delete out[k];
        clamped = true;
        warnings.push(`unknown-key-removed:${k}`);
      }
    }

    return { payload: out, clamped, warnings };
  }

  modelSelectionScope(): string {
    return SCOPE_MODEL_SELECTION;
  }
}
