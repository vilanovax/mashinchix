import { randomUUID } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CarBehaviorMetricsDaily,
  CarScores,
  Prisma,
  RecommendationSource,
  UserEventType,
  UserPreferenceSignal,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RecommendationSessionService } from '../tracking/recommendation-session.service';
import { RECOMMENDATION_MODEL_VERSION_V3 } from '../tracking/recommendation-model.constants';
import { toNumber } from '../common/decimal.util';
import { CreateRecommendationDto } from './dto/create-recommendation.dto';
import { RecommendV2Dto } from './dto/recommend-v2.dto';
import { RecommendV3Dto } from './dto/recommend-v3.dto';
import { buildRecommendationExplanationV3 } from './recommendation-v3.explain';
import {
  computeRecommendationScoreV3,
  type UserV3BehaviorState,
} from './recommendation-v3.scoring';

const carInclude = {
  specs: true,
  marketData: true,
  scores: true,
  pricePrediction: true,
} satisfies Prisma.CarInclude;

const carIncludeV3 = {
  ...carInclude,
  ownershipCost: true,
} satisfies Prisma.CarInclude;

type CarRec = Prisma.CarGetPayload<{ include: typeof carInclude }>;
type CarV3Rec = Prisma.CarGetPayload<{ include: typeof carIncludeV3 }>;

const WEIGHT_KEYS = [
  'performance',
  'comfort',
  'economy',
  'reliability',
  'market',
  'ownership',
  'prestige',
] as const;

const WEIGHT_KEYS_V2 = [
  ...WEIGHT_KEYS,
  'investment',
  'popularity',
  'ownerSatisfaction',
] as const;

type WeightKeyV2 = (typeof WEIGHT_KEYS_V2)[number];

const CAR_SCORE_FIELD: Record<
  Exclude<WeightKeyV2, 'risk'>,
  keyof CarScores
> = {
  performance: 'performanceScore',
  comfort: 'comfortScore',
  economy: 'economyScore',
  reliability: 'reliabilityScore',
  market: 'marketScore',
  ownership: 'ownershipScore',
  prestige: 'prestigeScore',
  investment: 'investmentScore',
  popularity: 'popularityScore',
  ownerSatisfaction: 'ownerSatisfactionScore',
};

function nn(v: number | null | undefined, fallback = 50): number {
  return v ?? fallback;
}

function normalizeWeights(input?: CreateRecommendationDto['weights']): {
  w: Record<(typeof WEIGHT_KEYS)[number], number>;
  riskW: number;
} {
  const raw = WEIGHT_KEYS.map((k) =>
    input?.[k] != null && input[k]! >= 0 ? input[k]! : 1,
  );
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  const w = Object.fromEntries(
    WEIGHT_KEYS.map((k, i) => [k, raw[i] / sum]),
  ) as Record<(typeof WEIGHT_KEYS)[number], number>;
  const riskW =
    input?.risk != null && input.risk >= 0 ? input.risk : 0.12;
  return { w, riskW };
}

function finalScoreForCar(
  scores: CarScores | null | undefined,
  w: Record<(typeof WEIGHT_KEYS)[number], number>,
  riskW: number,
): number {
  if (!scores) return 0;
  let sum = 0;
  sum += w.performance * nn(scores.performanceScore);
  sum += w.comfort * nn(scores.comfortScore);
  sum += w.economy * nn(scores.economyScore);
  sum += w.reliability * nn(scores.reliabilityScore);
  sum += w.market * nn(scores.marketScore);
  sum += w.ownership * nn(scores.ownershipScore);
  sum += w.prestige * nn(scores.prestigeScore);
  sum -= riskW * nn(scores.riskScore);
  return sum;
}

function readProfileWeightJson(
  profile: { scoreWeights: unknown } | null | undefined,
): Record<string, number> {
  if (
    !profile?.scoreWeights ||
    typeof profile.scoreWeights !== 'object' ||
    profile.scoreWeights === null
  ) {
    return {};
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(profile.scoreWeights)) {
    if (typeof v === 'number' && v >= 0) out[k] = v;
  }
  return out;
}

function normalizeWeightsV2(
  dto: RecommendV2Dto['weights'],
  profile: {
    scoreWeights: unknown;
    investmentBias: number | null;
    popularityWeight: number | null;
    ownerSatisfactionWeight: number | null;
  } | null,
): { w: Record<WeightKeyV2, number>; riskW: number } {
  const pj = readProfileWeightJson(profile);
  const dtoW = dto as Partial<Record<WeightKeyV2 | 'risk', number>> | undefined;

  const pick = (key: WeightKeyV2, fallback: number): number => {
    const fromDto = dtoW?.[key];
    if (fromDto != null && fromDto >= 0) return fromDto;
    if (pj[key] != null && pj[key] >= 0) return pj[key];
    return fallback;
  };

  const raw = WEIGHT_KEYS_V2.map((key) => {
    switch (key) {
      case 'investment':
        return pick(
          'investment',
          profile?.investmentBias != null
            ? 0.35 + profile.investmentBias * 0.65
            : 0.4,
        );
      case 'popularity':
        return pick('popularity', profile?.popularityWeight ?? 0.28);
      case 'ownerSatisfaction':
        return pick(
          'ownerSatisfaction',
          profile?.ownerSatisfactionWeight ?? 0.32,
        );
      default:
        return pick(key, 1);
    }
  });
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  const w = Object.fromEntries(
    WEIGHT_KEYS_V2.map((k, i) => [k, raw[i] / sum]),
  ) as Record<WeightKeyV2, number>;

  const riskW =
    dtoW?.risk != null && dtoW.risk >= 0
      ? dtoW.risk
      : typeof pj['risk'] === 'number' && pj['risk'] >= 0
        ? pj['risk']
        : 0.12;

  return { w, riskW };
}

function finalScoreForCarV2(
  scores: CarScores | null | undefined,
  w: Record<WeightKeyV2, number>,
  riskW: number,
): number {
  if (!scores) return 0;
  let sum = 0;
  for (const key of WEIGHT_KEYS_V2) {
    const field = CAR_SCORE_FIELD[key];
    sum += w[key] * nn(scores[field] as number | null);
  }
  sum -= riskW * nn(scores.riskScore);
  return sum;
}

function buildRecommendationExplanation(
  car: CarRec,
  w: Record<WeightKeyV2, number>,
  riskW: number,
  budget: number,
  segmentMatched: boolean,
  learningReasons?: string[],
): {
  breakdown: Record<string, number>;
  topContributingDimensions: string[];
  reasons: string[];
} {
  const s = car.scores;
  const breakdown: Record<string, number> = {};
  if (!s) {
    const reasonsEarly: string[] = [];
    if (learningReasons?.length) {
      for (const line of learningReasons) {
        if (line && !reasonsEarly.includes(line)) reasonsEarly.push(line);
      }
    }
    return {
      breakdown: {},
      topContributingDimensions: [],
      reasons: reasonsEarly,
    };
  }

  for (const key of WEIGHT_KEYS_V2) {
    const field = CAR_SCORE_FIELD[key];
    breakdown[key] =
      Math.round(w[key] * nn(s[field] as number | null) * 1000) / 1000;
  }
  breakdown.riskPenalty =
    Math.round(-riskW * nn(s.riskScore) * 1000) / 1000;

  const rankedDims = WEIGHT_KEYS_V2.map((k) => ({
    k,
    v: breakdown[k]!,
  })).sort((a, b) => b.v - a.v);
  const topContributingDimensions = rankedDims.slice(0, 3).map((d) => d.k);

  const reasons: string[] = [];
  const avgP = car.marketData?.avgPrice
    ? toNumber(car.marketData.avgPrice)
    : null;
  if (avgP != null && avgP <= budget) {
    reasons.push('Within your budget');
  }
  if (nn(s.riskScore) <= 42) reasons.push('Low risk');
  if (nn(s.reliabilityScore) >= 66) reasons.push('High reliability');
  if (nn(s.investmentScore) >= 66) {
    reasons.push('Strong investment profile');
  }
  if (nn(s.ownershipScore) >= 62) {
    reasons.push('Favorable ownership / upkeep perception');
  }
  if (segmentMatched) reasons.push('Matches your preferred segments');
  const pchg = car.pricePrediction?.predictedChange30d
    ? toNumber(car.pricePrediction.predictedChange30d)
    : null;
  if (pchg != null && pchg > 0.015) {
    reasons.push('Positive short-term price outlook');
  }
  if (nn(s.marketScore) >= 65) reasons.push('Healthy market metrics');

  if (learningReasons?.length) {
    for (const line of learningReasons) {
      if (line && !reasons.includes(line)) reasons.push(line);
    }
  }

  return {
    breakdown,
    topContributingDimensions,
    reasons,
  };
}

function buildLearningContext(
  car: CarRec,
  signal: UserPreferenceSignal | null,
  segmentMatch: boolean,
  budget: number,
): {
  matchedSegment?: string;
  matchedBehaviorSignal?: string;
  confidence?: number;
} | undefined {
  if (!signal) return undefined;

  const segHit = signal.preferredSegments.find((s) =>
    (car.segment ?? '').toLowerCase().includes(s.toLowerCase()),
  );

  const hints: string[] = [];
  if (segHit) {
    hints.push(`Matched preferred segment from behavior (${segHit})`);
  }
  if (signal.favoriteCarIds.includes(car.id)) {
    hints.push('Repeated interest pattern (clicks/saves) on this vehicle');
  }

  const iw =
    signal.inferredWeights &&
    typeof signal.inferredWeights === 'object' &&
    !Array.isArray(signal.inferredWeights)
      ? (signal.inferredWeights as Record<string, number>)
      : {};

  const s = car.scores;
  if (s) {
    if ((iw.performance ?? 1) > 1.06 && nn(s.performanceScore) >= 62) {
      hints.push('Aligns with inferred performance preference');
    }
    if ((iw.investment ?? 1) > 1.06 && nn(s.investmentScore) >= 62) {
      hints.push('Aligns with inferred investment bias');
    }
    if ((iw.economy ?? 1) > 1.04 && nn(s.riskScore) <= 45) {
      hints.push('Low risk consistent with economy/reliability signal from past choices');
    }
    if (segmentMatch && segHit) {
      hints.push('Explicit profile and behavior both favor this segment');
    }
  }

  const avgP = car.marketData?.avgPrice
    ? toNumber(car.marketData.avgPrice)
    : null;
  if (avgP != null && avgP <= budget) {
    hints.push('Within stated budget');
  }

  const confidence =
    signal.confidenceScore != null
      ? Math.round(signal.confidenceScore * 100) / 100
      : undefined;

  if (!segHit && hints.length === 0) {
    return confidence == null ? undefined : { confidence };
  }

  return {
    matchedSegment: segHit,
    matchedBehaviorSignal:
      hints.length > 0 ? hints.join(' · ') : undefined,
    confidence,
  };
}

@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: RecommendationSessionService,
  ) {}

  private serialize(car: CarRec, finalScore: number) {
    return {
      id: car.id,
      brand: car.brand,
      model: car.model,
      year: car.year,
      bodyType: car.bodyType,
      segment: car.segment,
      image: car.image,
      pros: car.pros,
      cons: car.cons,
      specs: car.specs,
      marketData: car.marketData
        ? {
            ...car.marketData,
            avgPrice: toNumber(car.marketData.avgPrice),
            minPrice: toNumber(car.marketData.minPrice),
            maxPrice: toNumber(car.marketData.maxPrice),
            priceChange30d: toNumber(car.marketData.priceChange30d),
            priceChange1y: toNumber(car.marketData.priceChange1y),
            depreciationRate30d: toNumber(
              car.marketData.depreciationRate30d,
            ),
          }
        : null,
      scores: car.scores,
      recommendationFinalScore: Math.round(finalScore * 100) / 100,
      pricePrediction: car.pricePrediction
        ? {
            predictedChange30d: toNumber(
              car.pricePrediction.predictedChange30d,
            ),
            confidence: car.pricePrediction.confidence,
          }
        : null,
    };
  }

  private serializeV3(car: CarV3Rec, finalScore: number) {
    const base = this.serialize(car as CarRec, finalScore);
    const oc = car.ownershipCost;
    return {
      ...base,
      ownershipCost: oc
        ? {
            fuelMonthlyTomans:
              oc.fuelMonthlyTomans != null
                ? toNumber(oc.fuelMonthlyTomans)
                : null,
            maintenanceYearlyTomans:
              oc.maintenanceYearlyTomans != null
                ? toNumber(oc.maintenanceYearlyTomans)
                : null,
            depreciationAnnualRate:
              oc.depreciationAnnualRate != null
                ? toNumber(oc.depreciationAnnualRate)
                : null,
          }
        : null,
    };
  }

  private dtoBaseWeightsV3(
    weights?: RecommendV2Dto['weights'],
  ):
    | Partial<
        Record<
          | 'performance'
          | 'economy'
          | 'reliability'
          | 'comfort'
          | 'market'
          | 'ownership'
          | 'prestige',
          number
        >
      >
    | undefined {
    if (!weights) return undefined;
    return {
      performance: weights.performance,
      economy: weights.economy,
      reliability: weights.reliability,
      comfort: weights.comfort,
      market: weights.market,
      ownership: weights.ownership,
      prestige: weights.prestige,
    };
  }

  private async loadLatestBehaviorMetrics(
    carIds: string[],
  ): Promise<Map<string, CarBehaviorMetricsDaily>> {
    const map = new Map<string, CarBehaviorMetricsDaily>();
    if (carIds.length === 0) return map;
    const rows = await this.prisma.carBehaviorMetricsDaily.findMany({
      where: { carId: { in: carIds } },
      orderBy: { snapshotDate: 'desc' },
    });
    for (const r of rows) {
      if (!map.has(r.carId)) map.set(r.carId, r);
    }
    return map;
  }

  private normSegLocal(s: string): string {
    return s.trim().toLowerCase();
  }

  private async loadUserV3BehaviorState(
    userId: string,
  ): Promise<UserV3BehaviorState> {
    const dismissAgg = await this.prisma.userEvent.groupBy({
      by: ['carId'],
      where: {
        userId,
        eventType: UserEventType.RECOMMENDATION_DISMISS,
        carId: { not: null },
      },
      _count: true,
    });
    const dismissCountByCar = new Map<string, number>();
    for (const row of dismissAgg) {
      if (row.carId != null) dismissCountByCar.set(row.carId, row._count);
    }

    const saveEvents = await this.prisma.userEvent.findMany({
      where: {
        userId,
        eventType: UserEventType.WISHLIST_ADD,
        carId: { not: null },
      },
      distinct: ['carId'],
      select: { carId: true },
    });
    const savedCarIds = new Set(
      saveEvents.map((e) => e.carId).filter((id): id is string => id != null),
    );

    const savedCars = savedCarIds.size
      ? await this.prisma.car.findMany({
          where: { id: { in: [...savedCarIds] } },
          select: { segment: true },
        })
      : [];
    const savedSegments = new Set<string>();
    for (const c of savedCars) {
      const sg = this.normSegLocal(c.segment ?? '');
      if (sg) savedSegments.add(sg);
    }

    const interactEvents = await this.prisma.userEvent.findMany({
      where: {
        userId,
        carId: { not: null },
        eventType: {
          in: [
            UserEventType.RECOMMENDATION_CLICK,
            UserEventType.CAR_DETAIL_VIEW,
          ],
        },
      },
      select: { carId: true },
    });
    const evCarIds = [...new Set(interactEvents.map((e) => e.carId!))];
    const carsForSeg =
      evCarIds.length > 0
        ? await this.prisma.car.findMany({
            where: { id: { in: evCarIds } },
            select: { id: true, segment: true },
          })
        : [];
    const idToSeg = new Map(carsForSeg.map((c) => [c.id, c.segment ?? '']));

    const segmentInteractionWeight = new Map<string, number>();
    for (const ev of interactEvents) {
      if (!ev.carId) continue;
      const seg = this.normSegLocal(idToSeg.get(ev.carId) ?? '');
      if (!seg) continue;
      segmentInteractionWeight.set(
        seg,
        (segmentInteractionWeight.get(seg) ?? 0) + 1,
      );
    }
    const maxSegmentInteraction = Math.max(
      0,
      ...segmentInteractionWeight.values(),
    );

    return {
      dismissCountByCar,
      savedCarIds,
      savedSegments,
      segmentInteractionWeight,
      maxSegmentInteraction,
    };
  }

  async recommend(dto: CreateRecommendationDto) {
    const { w, riskW } = normalizeWeights(dto.weights);

    const cars = await this.prisma.car.findMany({
      where: {
        marketData: {
          is: {
            avgPrice: { lte: dto.budget },
          },
        },
      },
      include: carInclude,
    });

    const ranked = cars
      .map((car) => ({
        car,
        finalScore: finalScoreForCar(car.scores, w, riskW),
      }))
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 5);

    return {
      budget: dto.budget,
      weightsUsed: { ...w, riskPenalty: riskW },
      count: ranked.length,
      recommendations: ranked.map((r) =>
        this.serialize(r.car, r.finalScore),
      ),
    };
  }

  async recommendV2(dto: RecommendV2Dto) {
    const user = dto.userId
      ? await this.prisma.user.findUnique({
          where: { id: dto.userId },
          include: { profile: true },
        })
      : null;

    if (dto.userId && !user) {
      throw new BadRequestException(`کاربر ${dto.userId} یافت نشد`);
    }

    let budget = dto.budget;
    if (budget == null && user) {
      if (user.budget != null) budget = toNumber(user.budget) ?? undefined;
      if (budget == null && user.profile?.maxBudget != null) {
        budget = toNumber(user.profile.maxBudget) ?? undefined;
      }
    }

    if (budget == null || !Number.isFinite(budget)) {
      throw new BadRequestException(
        'بودجه مشخص نیست؛ budget بفرستید یا برای userId مقدار budget / profile.maxBudget تنظیم کنید',
      );
    }

    const minBudget =
      user?.profile?.minBudget != null
        ? toNumber(user.profile.minBudget)
        : null;

    const { w, riskW } = normalizeWeightsV2(
      dto.weights,
      user?.profile ?? null,
    );

    const preferred = user?.profile?.preferredSegments ?? [];
    const segmentHints = [
      ...(dto.segmentHint ? [dto.segmentHint] : []),
      ...preferred,
    ];

    const cars = await this.prisma.car.findMany({
      where: {
        marketData: {
          is: {
            avgPrice: {
              lte: budget,
              ...(minBudget != null && Number.isFinite(minBudget)
                ? { gte: minBudget }
                : {}),
            },
          },
        },
      },
      include: carInclude,
    });

    let filtered = cars;
    if (segmentHints.length > 0) {
      const hinted = cars.filter((c) =>
        segmentHints.some(
          (h) =>
            (c.segment ?? '').toLowerCase().includes(h.toLowerCase()) ||
            `${c.brand} ${c.model}`.toLowerCase().includes(h.toLowerCase()),
        ),
      );
      if (hinted.length > 0) filtered = hinted;
    }

    const limit = Math.min(dto.limit ?? 5, 25);

    const ranked = filtered
      .map((car) => {
        let score = finalScoreForCarV2(car.scores, w, riskW);
        const segmentMatch =
          !!(
            user?.profile?.preferredSegments?.length &&
            car.segment &&
            user.profile.preferredSegments.some((s) =>
              car.segment!.toLowerCase().includes(s.toLowerCase()),
            )
          );
        if (segmentMatch) score *= 1.05;
        return { car, finalScore: score, segmentMatch };
      })
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);

    const preferenceSignal = dto.userId
      ? await this.prisma.userPreferenceSignal.findFirst({
          where: { userId: dto.userId },
          orderBy: { signalDate: 'desc' },
        })
      : null;

    const clientSessionId = dto.clientSessionId?.trim() || randomUUID();

    let source: RecommendationSource =
      dto.source ??
      (dto.userId
        ? RecommendationSource.PROFILE_BASED
        : RecommendationSource.API);
    if (dto.segmentHint && !dto.userId) {
      source = RecommendationSource.SCENARIO_BASED;
    }

    const rankedEnriched = ranked.map((r, i) => {
      const learningContext =
        dto.userId && preferenceSignal
          ? buildLearningContext(
              r.car,
              preferenceSignal,
              r.segmentMatch,
              budget,
            )
          : undefined;
      const learningReasons =
        learningContext?.matchedBehaviorSignal
          ?.split(' · ')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 3) ?? undefined;
      const explanation = buildRecommendationExplanation(
        r.car,
        w,
        riskW,
        budget,
        r.segmentMatch,
        learningReasons,
      );
      return {
        ...r,
        rank: i + 1,
        explanation,
        learningContext,
      };
    });

    const recommendationSessionId =
      await this.sessionService.createSessionWithResults({
        userId: dto.userId ?? null,
        clientSessionId,
        source,
        requestPayload: { ...dto, clientSessionId },
        results: rankedEnriched.map((r) => ({
          carId: r.car.id,
          rank: r.rank,
          finalScore: r.finalScore,
          explanation: r.explanation,
        })),
      });

    const results = rankedEnriched.map((r) => {
      const base = {
        rank: r.rank,
        ...this.serialize(r.car, r.finalScore),
        explanation: r.explanation,
      };
      return r.learningContext
        ? { ...base, learningContext: r.learningContext }
        : base;
    });

    return {
      recommendationSessionId,
      clientSessionId,
      engine: 'v2',
      userId: dto.userId ?? null,
      budget,
      weightsUsed: { ...w, riskPenalty: riskW },
      count: ranked.length,
      results,
      recommendations: results,
    };
  }

  async recommendV3(dto: RecommendV3Dto) {
    const user = dto.userId
      ? await this.prisma.user.findUnique({
          where: { id: dto.userId },
          include: { profile: true },
        })
      : null;

    if (dto.userId && !user) {
      throw new BadRequestException(`کاربر ${dto.userId} یافت نشد`);
    }

    let budget = dto.budget;
    if (budget == null && user) {
      if (user.budget != null) budget = toNumber(user.budget) ?? undefined;
      if (budget == null && user.profile?.maxBudget != null) {
        budget = toNumber(user.profile.maxBudget) ?? undefined;
      }
    }

    if (budget == null || !Number.isFinite(budget)) {
      throw new BadRequestException(
        'بودجه مشخص نیست؛ budget بفرستید یا برای userId مقدار budget / profile.maxBudget تنظیم کنید',
      );
    }

    const minBudget =
      user?.profile?.minBudget != null
        ? toNumber(user.profile.minBudget)
        : null;

    const preferred = user?.profile?.preferredSegments ?? [];
    const segmentHints = [
      ...(dto.segmentHint ? [dto.segmentHint] : []),
      ...preferred,
    ];

    const cars = await this.prisma.car.findMany({
      where: {
        marketData: {
          is: {
            avgPrice: {
              lte: budget,
              ...(minBudget != null && Number.isFinite(minBudget)
                ? { gte: minBudget }
                : {}),
            },
          },
        },
      },
      include: carIncludeV3,
    });

    let filtered = cars;
    if (segmentHints.length > 0) {
      const hinted = cars.filter((c) =>
        segmentHints.some(
          (h) =>
            (c.segment ?? '').toLowerCase().includes(h.toLowerCase()) ||
            `${c.brand} ${c.model}`.toLowerCase().includes(h.toLowerCase()),
        ),
      );
      if (hinted.length > 0) filtered = hinted;
    }

    const limit = Math.min(dto.limit ?? 5, 25);

    const preferenceSignal = dto.userId
      ? await this.prisma.userPreferenceSignal.findFirst({
          where: { userId: dto.userId },
          orderBy: { signalDate: 'desc' },
        })
      : null;

    const behaviorState = dto.userId
      ? await this.loadUserV3BehaviorState(dto.userId)
      : {
          dismissCountByCar: new Map(),
          savedCarIds: new Set<string>(),
          savedSegments: new Set<string>(),
          segmentInteractionWeight: new Map(),
          maxSegmentInteraction: 0,
        };

    const metricsMap = await this.loadLatestBehaviorMetrics(
      filtered.map((c) => c.id),
    );

    const { w, riskW } = normalizeWeightsV2(
      dto.weights,
      user?.profile ?? null,
    );

    const ranked = filtered
      .map((car) => {
        const segmentMatch =
          !!(
            user?.profile?.preferredSegments?.length &&
            car.segment &&
            user.profile.preferredSegments.some((s) =>
              car.segment!.toLowerCase().includes(s.toLowerCase()),
            )
          );
        const breakdown = computeRecommendationScoreV3({
          car,
          profile: user?.profile ?? null,
          signal: preferenceSignal,
          behaviorMetrics: metricsMap.get(car.id) ?? null,
          behaviorState,
          dtoWeights: this.dtoBaseWeightsV3(dto.weights),
        });
        return {
          car,
          finalScore: breakdown.finalScore,
          segmentMatch,
          breakdown,
          behaviorMetrics: metricsMap.get(car.id) ?? null,
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);

    const clientSessionId = dto.clientSessionId?.trim() || randomUUID();

    let source: RecommendationSource =
      dto.source ??
      (dto.userId
        ? RecommendationSource.PROFILE_BASED
        : RecommendationSource.API);
    if (dto.segmentHint && !dto.userId) {
      source = RecommendationSource.SCENARIO_BASED;
    }

    const rankedEnriched = ranked.map((r, i) => {
      const explanationV3 = buildRecommendationExplanationV3({
        car: r.car,
        breakdown: r.breakdown,
        profile: user?.profile ?? null,
        signal: preferenceSignal,
        behaviorMetrics: r.behaviorMetrics,
        profileSegmentMatch: r.segmentMatch,
        budget,
      });

      const learningContext =
        dto.userId && preferenceSignal
          ? buildLearningContext(
              r.car,
              preferenceSignal,
              r.segmentMatch,
              budget,
            )
          : undefined;

      const learningReasons =
        learningContext?.matchedBehaviorSignal
          ?.split(' · ')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 3) ?? undefined;

      const explanationV2Style = buildRecommendationExplanation(
        r.car,
        w,
        riskW,
        budget,
        r.segmentMatch,
        learningReasons,
      );

      return {
        ...r,
        rank: i + 1,
        explanation: {
          structured: explanationV3,
          legacySummary: explanationV2Style,
        },
        learningContext,
      };
    });

    const recommendationSessionId =
      await this.sessionService.createSessionWithResults({
        userId: dto.userId ?? null,
        clientSessionId,
        source,
        requestPayload: { ...dto, engine: 'v3', clientSessionId },
        modelVersion: RECOMMENDATION_MODEL_VERSION_V3,
        results: rankedEnriched.map((r) => ({
          carId: r.car.id,
          rank: r.rank,
          finalScore: r.finalScore,
          explanation: r.explanation,
        })),
      });

    const results = rankedEnriched.map((r) => {
      const base = {
        rank: r.rank,
        ...this.serializeV3(r.car, r.finalScore),
        explanation: r.explanation,
      };
      return r.learningContext
        ? { ...base, learningContext: r.learningContext }
        : base;
    });

    return {
      recommendationSessionId,
      clientSessionId,
      engine: 'v3',
      userId: dto.userId ?? null,
      budget,
      modelVersion: RECOMMENDATION_MODEL_VERSION_V3,
      weightsUsed: { ...w, riskPenalty: riskW },
      count: ranked.length,
      results,
      recommendations: results,
    };
  }
}
