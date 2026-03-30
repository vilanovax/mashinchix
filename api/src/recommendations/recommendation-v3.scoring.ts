import type {
  Car,
  CarBehaviorMetricsDaily,
  CarMarketData,
  CarScores,
  CarSpecs,
  OwnershipCost,
  PricePrediction,
  UserPreferenceSignal,
  UserProfile,
} from '@prisma/client';
import { toNumber } from '../common/decimal.util';

const N = (v: number | null | undefined, d = 50) => v ?? d;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** نرمال ۰–۱۰۰ */
function toUnit100(x: number | null | undefined): number {
  return clamp(N(x, 50), 0, 100);
}

export type CarV3Payload = Car & {
  specs: CarSpecs | null;
  marketData: CarMarketData | null;
  scores: CarScores | null;
  ownershipCost: OwnershipCost | null;
  pricePrediction: PricePrediction | null;
};

export type UserV3BehaviorState = {
  dismissCountByCar: ReadonlyMap<string, number>;
  savedCarIds: ReadonlySet<string>;
  savedSegments: ReadonlySet<string>;
  /** سگمنت نرمال‌شده → وزن تعامل */
  segmentInteractionWeight: ReadonlyMap<string, number>;
  maxSegmentInteraction: number;
};

const BASE_KEYS = [
  'performance',
  'economy',
  'reliability',
  'comfort',
  'market',
  'ownership',
  'prestige',
] as const;

type BaseKey = (typeof BASE_KEYS)[number];

const SCORE_FIELD: Record<BaseKey, keyof CarScores> = {
  performance: 'performanceScore',
  economy: 'economyScore',
  reliability: 'reliabilityScore',
  comfort: 'comfortScore',
  market: 'marketScore',
  ownership: 'ownershipScore',
  prestige: 'prestigeScore',
};

function normSeg(s: string): string {
  return s.trim().toLowerCase();
}

function readJsonWeights(
  raw: unknown,
): Partial<Record<BaseKey | 'investment' | string, number>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && v >= 0) out[k] = v;
  }
  return out;
}

function mergeBaseWeights(
  dtoW: Partial<Record<BaseKey, number>> | undefined,
  profile: UserProfile | null | undefined,
  inferred: Record<string, number> | undefined,
  confidence: number,
): Record<BaseKey, number> {
  const pj = readJsonWeights(profile?.scoreWeights) as Partial<
    Record<BaseKey, number>
  >;
  const picks = BASE_KEYS.map((k) => {
    const fromDto = dtoW?.[k];
    if (fromDto != null && fromDto >= 0) return fromDto;
    if (pj[k] != null && pj[k]! >= 0) return pj[k]!;
    const inf = inferred?.[k];
    if (inf != null && inf > 0 && confidence > 0.12) {
      return clamp(1 + (inf - 1) * confidence, 0.35, 2.4);
    }
    return 1;
  });
  const sum = picks.reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(
    BASE_KEYS.map((k, i) => [k, picks[i]! / sum]),
  ) as Record<BaseKey, number>;
}

/** A) امتیاز پایهٔ هوشمندی ۰–۱۰۰ */
export function computeBaseIntelligenceScoreV3(
  scores: CarScores | null | undefined,
  weights: Record<BaseKey, number>,
): number {
  if (!scores) return 45;
  let acc = 0;
  for (const k of BASE_KEYS) {
    const field = SCORE_FIELD[k];
    acc += weights[k] * N(scores[field] as number | null, 50);
  }
  return clamp(acc, 0, 100);
}

/** B) امتیاز بازار ۰–۱۰۰ */
export function computeMarketScoreNormV3(
  md: CarMarketData | null | undefined,
  pred: PricePrediction | null | undefined,
): number {
  if (!md && !pred) return 50;

  const liq = toUnit100(md?.liquidityScore);
  const dem = toUnit100(md?.demandScore);
  const vol = toUnit100(md?.volatilityScore);
  const trend = toUnit100(md?.priceTrendScore ?? 50);

  const chRaw =
    pred?.predictedChange30d != null
      ? toNumber(pred.predictedChange30d)
      : null;
  const ch =
    chRaw != null && Number.isFinite(chRaw) ? chRaw : 0;
  const predPart = clamp(50 + ch * 420, 0, 100);

  const buy = N(md?.buyScore, 50);
  const sell = N(md?.sellScore, 50);
  const bsPart = clamp(50 + (buy - sell) * 0.35, 0, 100);

  let s =
    0.22 * liq +
    0.2 * dem +
    0.18 * vol +
    0.15 * trend +
    0.15 * predPart +
    0.1 * bsPart;

  const sig = (md?.marketSignal ?? '').toUpperCase();
  if (sig === 'BUY') s = clamp(s * 1.06 + 4, 0, 100);
  if (sig === 'SELL') s = clamp(s * 0.9 - 6, 0, 100);

  return clamp(s, 0, 100);
}

function normalizeCtrLike(x: number | null | undefined): number {
  if (x == null || !Number.isFinite(x)) return 50;
  return clamp(50 + (x - 0.12) * 220, 0, 100);
}

function normalizeRate(x: number | null | undefined): number {
  if (x == null || !Number.isFinite(x)) return 50;
  return clamp(x * 280, 0, 100);
}

function normalizeLogViews(n: number): number {
  return clamp((Math.log10(n + 1) / 4) * 100, 0, 100);
}

/** C) امتیاز رفتار تجمیعی ۰–۱۰۰ */
export function computeBehaviorScoreNormV3(
  metrics: CarBehaviorMetricsDaily | null | undefined,
  scores: CarScores | null | undefined,
  marketData: CarMarketData | null | undefined,
): number {
  const ctrN = normalizeCtrLike(metrics?.ctrRecommendation);
  const saveN = normalizeRate(metrics?.saveRate);
  const dismissN = normalizeRate(metrics?.dismissRate);
  const views = metrics?.detailViews ?? 0;
  const viewN = normalizeLogViews(views);

  const popTrend = marketData?.popularityTrendScore ?? 50;

  let b =
    0.35 * ctrN +
    0.28 * saveN +
    0.17 * viewN -
    0.28 * dismissN +
    0.12 * toUnit100(scores?.popularityScore) +
    0.08 * toUnit100(popTrend);

  if (!metrics) {
    b =
      0.55 * toUnit100(scores?.popularityScore) +
      0.45 * toUnit100(popTrend);
  }

  return clamp(b, 0, 100);
}

/** D) شخصی‌سازی ۰–۱۰۰ */
export function computePersonalizationScoreV3(input: {
  car: CarV3Payload;
  profile: UserProfile | null | undefined;
  signal: UserPreferenceSignal | null | undefined;
  behavior: UserV3BehaviorState;
}): number {
  const { car, profile, signal, behavior } = input;
  const conf = clamp(N(signal?.confidenceScore, 0), 0, 1);

  let p = 48;

  const seg = car.segment ? normSeg(car.segment) : '';

  const profileSegHit =
    !!profile?.preferredSegments?.some(
      (s) => seg && seg.includes(normSeg(s)),
    ) ||
    !!profile?.preferredSegments?.some(
      (s) => normSeg(s) && seg.includes(normSeg(s)),
    );

  const signalSegHit = !!signal?.preferredSegments?.some(
    (s) => seg && (seg.includes(normSeg(s)) || normSeg(s).includes(seg)),
  );

  if (profileSegHit) p += 16;
  if (signalSegHit) p += 12 * (0.35 + 0.65 * conf);

  const favIds = signal?.favoriteCarIds ?? [];
  if (favIds.includes(car.id)) p += 22 * (0.4 + 0.6 * conf);
  else if (seg && behavior.savedSegments.has(seg)) {
    p += 10 * (0.35 + 0.65 * conf);
  }

  const dismiss = behavior.dismissCountByCar.get(car.id) ?? 0;
  if (dismiss >= 3) p -= 28;
  else if (dismiss === 2) p -= 18;
  else if (dismiss === 1) p -= 8;

  const maxI = Math.max(1, behavior.maxSegmentInteraction);
  const sw = seg ? behavior.segmentInteractionWeight.get(seg) ?? 0 : 0;
  if (sw > 0 && behavior.maxSegmentInteraction > 0) {
    p += 14 * conf * (sw / maxI);
  }

  const bias = N(profile?.investmentBias, 0);
  const inv = N(car.scores?.investmentScore, 50);
  p += clamp(bias * ((inv - 50) / 50) * 10, -12, 12);

  const hold = profile?.holdHorizonMonths ?? 0;
  if (hold >= 24 && inv >= 60) {
    p += 5 * clamp(hold / 48, 0.5, 1.2) * (0.5 + 0.5 * conf);
  }

  return clamp(p, 0, 100);
}

export type V3ScoreBreakdown = {
  baseScore: number;
  marketScore: number;
  behaviorScore: number;
  personalizationScore: number;
  investmentNorm: number;
  riskPenalty: number;
  finalPreClamp: number;
  finalScore: number;
};

/** ترکیب نهایی v3 (همهٔ اجزا ۰–۱۰۰) */
export function computeRecommendationScoreV3(input: {
  car: CarV3Payload;
  profile: UserProfile | null | undefined;
  signal: UserPreferenceSignal | null | undefined;
  behaviorMetrics: CarBehaviorMetricsDaily | null | undefined;
  behaviorState: UserV3BehaviorState;
  dtoWeights?: Partial<Record<BaseKey, number>>;
}): V3ScoreBreakdown {
  const { car, profile, signal, behaviorMetrics, behaviorState, dtoWeights } =
    input;

  const conf = clamp(N(signal?.confidenceScore, 0), 0, 1);
  const inferred =
    signal?.inferredWeights &&
    typeof signal.inferredWeights === 'object' &&
    !Array.isArray(signal.inferredWeights)
      ? (signal.inferredWeights as Record<string, number>)
      : undefined;

  const w = mergeBaseWeights(dtoWeights, profile, inferred, conf);
  const baseScore = computeBaseIntelligenceScoreV3(car.scores, w);
  const marketScore = computeMarketScoreNormV3(
    car.marketData,
    car.pricePrediction,
  );
  const behaviorScore = computeBehaviorScoreNormV3(
    behaviorMetrics,
    car.scores,
    car.marketData,
  );
  const personalizationScore = computePersonalizationScoreV3({
    car,
    profile,
    signal,
    behavior: behaviorState,
  });
  const investmentNorm = toUnit100(car.scores?.investmentScore);
  const riskPenalty = (N(car.scores?.riskScore, 50) / 100) * 16;

  const finalPreClamp =
    0.4 * baseScore +
    0.2 * marketScore +
    0.15 * behaviorScore +
    0.15 * personalizationScore +
    0.1 * investmentNorm -
    riskPenalty;

  return {
    baseScore,
    marketScore,
    behaviorScore,
    personalizationScore,
    investmentNorm,
    riskPenalty,
    finalPreClamp,
    finalScore: clamp(finalPreClamp, 0, 100),
  };
}
