function clamp(x: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, x));
}

/** امتیاز ۰–۱۰۰ سرمایه‌گذاری از افت، نقدشوندگی، تقاضا و پیش‌بینی روند قیمت */
export function computeInvestmentScore(input: {
  depreciationRate30d: number | null;
  liquidityScore: number | null;
  demandScore: number | null;
  predictedChange30d: number | null;
}): number {
  const L = input.liquidityScore ?? 50;
  const D = input.demandScore ?? 50;
  const dep = input.depreciationRate30d;
  const depComp =
    dep != null ? clamp(50 + dep * 150, 0, 100) : 45;
  const pred = input.predictedChange30d;
  const predComp =
    pred != null ? clamp(50 + pred * 400, 0, 100) : 45;
  const raw =
    0.25 * depComp + 0.25 * L + 0.25 * D + 0.25 * predComp;
  return Math.round(raw * 10) / 10;
}
