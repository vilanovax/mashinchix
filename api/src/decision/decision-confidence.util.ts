export type DecisionConfidenceWeights = {
  base: number;
  mapeSensitivity: number;
  regimeSensitivity: number;
  volHighPenalty: number;
  volLowBoost: number;
  buySignalBoost: number;
  momHighBoost: number;
  momLowPenalty: number;
  stressPenalty: number;
  scale: number;
};

export const DEFAULT_DECISION_CONFIDENCE: DecisionConfidenceWeights = {
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

export function computeDecisionConfidence(
  params: {
    mapeApprox: number | null;
    bullShare: number;
    avgVolatilityScore: number | null;
    buySignalRatio: number;
    bearShare: number;
    avgMomentum: number | null;
    stressMaxDd?: number | null;
  },
  w: Partial<DecisionConfidenceWeights> = {},
): number {
  const W = { ...DEFAULT_DECISION_CONFIDENCE, ...w };
  let c = W.base;
  if (params.mapeApprox != null) {
    const m = Math.min(0.5, Math.abs(params.mapeApprox));
    c += (0.12 - m) * W.mapeSensitivity;
  } else {
    c -= 5;
  }
  const regimeClarity =
    Math.abs(params.bullShare - 0.5) + Math.abs(params.bearShare - 0.25);
  c += regimeClarity * W.regimeSensitivity;

  if (params.avgVolatilityScore != null) {
    if (params.avgVolatilityScore > 58) c -= W.volHighPenalty;
    if (params.avgVolatilityScore < 38) c += W.volLowBoost;
  }
  if (params.buySignalRatio > 0.08) c += W.buySignalBoost;
  if (params.avgMomentum != null) {
    if (params.avgMomentum > 2) c += W.momHighBoost;
    if (params.avgMomentum < -2) c -= W.momLowPenalty;
  }
  if (params.stressMaxDd != null && params.stressMaxDd > 0.35) {
    c -= W.stressPenalty;
  }

  const adj = (c - W.base) * W.scale + W.base;
  return Math.round(Math.max(18, Math.min(94, adj)) * 10) / 10;
}
