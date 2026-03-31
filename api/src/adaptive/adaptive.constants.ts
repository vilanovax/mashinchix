import { Prisma } from '@prisma/client';

export const SCOPE_SCORING_BLEND = 'scoring_blend';
export const SCOPE_MODEL_SELECTION = 'model_selection';
export const SCOPE_RECOMMENDATION_BLEND = 'recommendation_blend';
export const SCOPE_TRIGGER_THRESHOLDS = 'trigger_thresholds';
export const SCOPE_DECISION_CONFIDENCE = 'decision_confidence';

/** همهٔ scopeهای نسخه‌پذیر */
export const ADAPTIVE_SCOPES = [
  SCOPE_SCORING_BLEND,
  SCOPE_MODEL_SELECTION,
  SCOPE_RECOMMENDATION_BLEND,
  SCOPE_TRIGGER_THRESHOLDS,
  SCOPE_DECISION_CONFIDENCE,
] as const;

export const ADAPTIVE_NUMERIC_SCOPES = [
  SCOPE_SCORING_BLEND,
  SCOPE_RECOMMENDATION_BLEND,
  SCOPE_TRIGGER_THRESHOLDS,
  SCOPE_DECISION_CONFIDENCE,
] as const;

export const DEFAULT_SCORING_BLEND: Record<string, number> = {
  performance: 1,
  economy: 1,
  reliability: 1,
  market: 1,
  risk: 1,
  investment: 1,
  popularity: 1,
  momentum: 1,
  liquidity: 1,
  ownership: 1,
  prestige: 1,
  ownerSatisfaction: 1,
  time_to_sell: 1,
  investment_dep: 1,
  investment_liq: 1,
  investment_demand: 1,
  investment_pred: 1,
  risk_vol: 1,
  risk_dep: 1,
  risk_liq: 1,
  risk_rel: 1,
};

export const DEFAULT_RECOMMENDATION_BLEND: Record<string, number> = {
  baseScore: 0.4,
  marketScore: 0.2,
  behaviorScore: 0.15,
  personalizationScore: 0.15,
  investmentScore: 0.1,
  riskPenalty: 1,
  momentum: 0,
  liquidity: 0,
};

export const DEFAULT_TRIGGER_THRESHOLDS: Record<string, number> = {
  price_drop_pct: 0.07,
  price_spike: 0.08,
  volatility_spike: 78,
  liquidity_drop: 38,
  demand_spike: 72,
  portfolio_drift_pct: 0.14,
  risk_increase_threshold: 68,
  segment_rotation_pct: 0.045,
};

export const DEFAULT_DECISION_CONFIDENCE: Record<string, number> = {
  base: 52,
  mapeSensitivity: 120,
  regimeSensitivity: 22,
  volHighPenalty: 12,
  volLowBoost: 6,
  buySignalBoost: 6,
  momHighBoost: 5,
  momLowPenalty: 6,
  stressPenalty: 10,
  scale: 1,
};

export const ADAPTIVE_SEED_ROWS: Array<{
  scope: string;
  weights: Prisma.InputJsonValue;
  note: string;
}> = [
  {
    scope: SCOPE_SCORING_BLEND,
    weights: DEFAULT_SCORING_BLEND as unknown as Prisma.InputJsonValue,
    note: 'seed',
  },
  {
    scope: SCOPE_MODEL_SELECTION,
    weights: {} as Prisma.InputJsonValue,
    note: 'model keys',
  },
  {
    scope: SCOPE_RECOMMENDATION_BLEND,
    weights: DEFAULT_RECOMMENDATION_BLEND as unknown as Prisma.InputJsonValue,
    note: 'seed',
  },
  {
    scope: SCOPE_TRIGGER_THRESHOLDS,
    weights: DEFAULT_TRIGGER_THRESHOLDS as unknown as Prisma.InputJsonValue,
    note: 'seed',
  },
  {
    scope: SCOPE_DECISION_CONFIDENCE,
    weights: DEFAULT_DECISION_CONFIDENCE as unknown as Prisma.InputJsonValue,
    note: 'seed',
  },
];
