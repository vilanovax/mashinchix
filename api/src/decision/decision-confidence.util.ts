export function computeDecisionConfidence(params: {
  mapeApprox: number | null;
  bullShare: number;
  avgVolatilityScore: number | null;
  buySignalRatio: number;
  bearShare: number;
  avgMomentum: number | null;
  stressMaxDd?: number | null;
}): number {
  let c = 52;
  if (params.mapeApprox != null) {
    const m = Math.min(0.5, Math.abs(params.mapeApprox));
    c += (0.12 - m) * 120;
  } else {
    c -= 5;
  }
  const regimeClarity =
    Math.abs(params.bullShare - 0.5) + Math.abs(params.bearShare - 0.25);
  c += regimeClarity * 22;

  if (params.avgVolatilityScore != null) {
    if (params.avgVolatilityScore > 58) c -= 12;
    if (params.avgVolatilityScore < 38) c += 6;
  }
  if (params.buySignalRatio > 0.08) c += 6;
  if (params.avgMomentum != null) {
    if (params.avgMomentum > 2) c += 5;
    if (params.avgMomentum < -2) c -= 6;
  }
  if (params.stressMaxDd != null && params.stressMaxDd > 0.35) c -= 10;

  return Math.round(Math.max(18, Math.min(94, c)) * 10) / 10;
}
