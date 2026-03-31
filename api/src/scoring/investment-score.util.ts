function clamp(x: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, x));
}

export type InvestmentBlendWeights = {
  dep: number;
  liquidity: number;
  demand: number;
  pred: number;
};

const DEFAULT_INV_BLEND: InvestmentBlendWeights = {
  dep: 0.25,
  liquidity: 0.25,
  demand: 0.25,
  pred: 0.25,
};

function norm4(w: Partial<InvestmentBlendWeights>): InvestmentBlendWeights {
  const m = { ...DEFAULT_INV_BLEND, ...w };
  const s = m.dep + m.liquidity + m.demand + m.pred;
  if (s < 1e-9) return DEFAULT_INV_BLEND;
  return {
    dep: m.dep / s,
    liquidity: m.liquidity / s,
    demand: m.demand / s,
    pred: m.pred / s,
  };
}

/** امتیاز ۰–۱۰۰ سرمایه‌گذاری از افت، نقدشوندگی، تقاضا و پیش‌بینی روند قیمت */
export function computeInvestmentScore(input: {
  depreciationRate30d: number | null;
  liquidityScore: number | null;
  demandScore: number | null;
  predictedChange30d: number | null;
  /** وزن نسبی اجزا (تطبیقی)؛ در صورت نبود، ۲۵٪ هر کدام */
  blend?: Partial<InvestmentBlendWeights>;
}): number {
  const L = input.liquidityScore ?? 50;
  const D = input.demandScore ?? 50;
  const dep = input.depreciationRate30d;
  const depComp =
    dep != null ? clamp(50 + dep * 150, 0, 100) : 45;
  const pred = input.predictedChange30d;
  const predComp =
    pred != null ? clamp(50 + pred * 400, 0, 100) : 45;
  const b = norm4(input.blend ?? {});
  const raw =
    b.dep * depComp +
    b.liquidity * L +
    b.demand * D +
    b.pred * predComp;
  return Math.round(raw * 10) / 10;
}
