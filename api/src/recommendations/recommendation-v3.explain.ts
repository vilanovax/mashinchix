import type {
  CarBehaviorMetricsDaily,
  CarMarketData,
  PricePrediction,
  UserPreferenceSignal,
  UserProfile,
} from '@prisma/client';
import { toNumber } from '../common/decimal.util';
import type { CarV3Payload, V3ScoreBreakdown } from './recommendation-v3.scoring';

function nn(v: number | null | undefined, d = 50): number {
  return v ?? d;
}

export type RecommendationExplanationV3 = {
  reasons: string[];
  topFactors: string[];
  marketContext: Record<string, unknown>;
  personalizationContext: Record<string, unknown>;
  behaviorContext: Record<string, unknown>;
  scoreBreakdown: V3ScoreBreakdown;
};

export function buildRecommendationExplanationV3(input: {
  car: CarV3Payload;
  breakdown: V3ScoreBreakdown;
  profile: UserProfile | null | undefined;
  signal: UserPreferenceSignal | null | undefined;
  behaviorMetrics: CarBehaviorMetricsDaily | null | undefined;
  profileSegmentMatch: boolean;
  budget: number;
}): RecommendationExplanationV3 {
  const { car, breakdown, profile, signal, behaviorMetrics, profileSegmentMatch, budget } =
    input;

  const reasons: string[] = [];
  const topFactors: string[] = [];

  const pushTop = (label: string, value: number) => {
    topFactors.push(`${label}:${Math.round(value)}`);
  };

  pushTop('base', breakdown.baseScore);
  pushTop('market', breakdown.marketScore);
  pushTop('behavior', breakdown.behaviorScore);
  pushTop('personal', breakdown.personalizationScore);
  pushTop('investment', breakdown.investmentNorm);

  const md = car.marketData;
  const pred = car.pricePrediction;
  const s = car.scores;
  const oc = car.ownershipCost;

  const marketContext: Record<string, unknown> = {
    liquidityScore: md?.liquidityScore ?? null,
    demandScore: md?.demandScore ?? null,
    volatilityScore: md?.volatilityScore ?? null,
    priceTrendScore: md?.priceTrendScore ?? null,
    priceTrendLabel: md?.priceTrendLabel ?? null,
    marketSignal: md?.marketSignal ?? null,
    buyScore: md?.buyScore ?? null,
    sellScore: md?.sellScore ?? null,
    predictedChange30d: pred?.predictedChange30d
      ? toNumber(pred.predictedChange30d)
      : null,
    predictionConfidence: pred?.confidence ?? null,
  };

  const personalizationContext: Record<string, unknown> = {
    profileSegments: profile?.preferredSegments ?? [],
    learnedSegments: signal?.preferredSegments ?? [],
    favoritesFromSignal: signal?.favoriteCarIds ?? [],
    learnedConfidence: signal?.confidenceScore ?? null,
    profileSegmentMatch,
    investmentBias: profile?.investmentBias ?? null,
    holdHorizonMonths: profile?.holdHorizonMonths ?? null,
  };

  const behaviorContext: Record<string, unknown> = {
    ctrRecommendation: behaviorMetrics?.ctrRecommendation ?? null,
    saveRate: behaviorMetrics?.saveRate ?? null,
    dismissRate: behaviorMetrics?.dismissRate ?? null,
    detailViews: behaviorMetrics?.detailViews ?? null,
    wishlistAdds: behaviorMetrics?.wishlistAdds ?? null,
    snapshotDate: behaviorMetrics?.snapshotDate ?? null,
    popularityScore: s?.popularityScore ?? null,
    popularityTrendScore:
      car.marketData?.popularityTrendScore ?? null,
  };

  if (md?.marketSignal === 'BUY' || nn(md?.buyScore) > nn(md?.sellScore) + 8) {
    reasons.push('Strong buy-side market signal for this model');
  }
  if (md?.marketSignal === 'SELL') {
    reasons.push('Caution: platform sell signal on market momentum');
  }
  if (nn(md?.liquidityScore) >= 65) {
    reasons.push('High liquidity / active listing market');
  }
  if (nn(md?.volatilityScore) >= 62) {
    reasons.push('Relatively stable price behavior (low volatility)');
  }
  const pch = pred?.predictedChange30d != null
    ? toNumber(pred.predictedChange30d)
    : null;
  if (pch != null && pch > 0.012) {
    reasons.push('Positive short-term price outlook');
  }

  if (behaviorMetrics?.ctrRecommendation != null) {
    const ctr = behaviorMetrics.ctrRecommendation;
    if (ctr >= 0.08) {
      reasons.push('High engagement (CTR) on recommendations for this car');
    }
  }
  if (behaviorMetrics?.saveRate != null && behaviorMetrics.saveRate >= 0.05) {
    reasons.push('Users often save this car after seeing it recommended');
  }
  if (profileSegmentMatch) {
    reasons.push('Matches your profile preferred segments');
  }
  if (
    signal?.preferredSegments?.length &&
    car.segment &&
    signal.preferredSegments.some((x) =>
      car.segment!.toLowerCase().includes(x.toLowerCase()),
    )
  ) {
    reasons.push('Aligns with segments inferred from your behavior');
  }
  if (signal?.favoriteCarIds.includes(car.id)) {
    reasons.push('You have shown repeated interest in this vehicle');
  }

  const avgP = md?.avgPrice != null ? toNumber(md.avgPrice) : null;
  if (avgP != null && avgP <= budget) {
    reasons.push('Within your budget');
  }

  if (nn(s?.riskScore) <= 42) {
    reasons.push('Low risk score');
  }
  if (nn(s?.investmentScore) >= 66) {
    reasons.push('Strong investment attractiveness score');
  }
  if (nn(s?.ownershipScore) >= 62) {
    reasons.push('Favorable ownership / upkeep perception');
  }

  if (oc?.maintenanceYearlyTomans != null) {
    const m = toNumber(oc.maintenanceYearlyTomans);
    if (
      m != null &&
      Number.isFinite(m) &&
      m > 0 &&
      m < 35_000_000
    ) {
      reasons.push('Estimated maintenance cost appears moderate');
    }
  }

  if (reasons.length === 0) {
    reasons.push('Balanced v3 score across intelligence, market, and behavior');
  }

  return {
    reasons,
    topFactors: topFactors.slice(0, 8),
    marketContext,
    personalizationContext,
    behaviorContext,
    scoreBreakdown: breakdown,
  };
}
