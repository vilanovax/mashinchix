import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';
import { aggregateNlpByDimension } from './feature-nlp-aggregate';
import { OwnershipCostService } from '../intelligence/ownership-cost.service';
import {
  computeOwnerSatisfactionScore,
  computePopularityScore,
} from './popularity-satisfaction.util';
import { computeInvestmentScore } from './investment-score.util';
import { sentimentFromReviewTexts } from '../nlp/review-window-sentiment.util';
import {
  AdaptiveWeightService,
  SCOPE_SCORING_BLEND,
} from '../learning/adaptive-weight.service';

/** وزن‌های پیش‌فرض overall (بدون risk که جداگانه کم می‌شود) */
const OVERALL_WEIGHTS = {
  performance: 1 / 7,
  comfort: 1 / 7,
  economy: 1 / 7,
  reliability: 1 / 7,
  market: 1 / 7,
  ownership: 1 / 7,
  prestige: 1 / 7,
} as const;

const RISK_PENALTY = 0.14;
const RISK_PENALTY_OVERALL_V3 = 0.12;

function clamp(x: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, x));
}

function nn(v: number | null | undefined, fallback = 50): number {
  return v != null && Number.isFinite(v) ? v : fallback;
}

/** افت منفی قیمت → ریسک بالاتر؛ خروجی ۰–۱۰۰ برای ترکیب در risk v2 */
function riskNormalizeDepreciation(dep: number | null): number {
  if (dep == null) return 50;
  return clamp(0, 100, 50 - dep * 120);
}

@Injectable()
export class CarScoreCalculationService {
  private readonly logger = new Logger(CarScoreCalculationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ownershipCost: OwnershipCostService,
    private readonly adaptive: AdaptiveWeightService,
  ) {}

  /** محاسبهٔ بازار + مخلوط با NLP؛ سپس ذخیره در CarScores */
  async recomputeForCar(
    carId: string,
    options?: {
      scoringBlend?: Record<string, number>;
      modelVersionLabel?: string;
    },
  ): Promise<void> {
    const car = await this.prisma.car.findUnique({
      where: { id: carId },
      include: {
        specs: true,
        marketData: true,
        featureScores: true,
      },
    });
    if (!car) {
      throw new NotFoundException(`Car ${carId} not found`);
    }

    const nlp = aggregateNlpByDimension(car.featureScores);
    const md = car.marketData;

    const liquidity = md?.liquidityScore ?? null;
    const demand = md?.demandScore ?? null;
    const dep = md?.depreciationRate30d
      ? toNumber(md.depreciationRate30d)
      : null;

    const marketFromData = this.blendMarketScore(liquidity, demand);

    const ownershipFromNlp = nlp.ownership;
    const ownershipScore = this.blendOwnership(ownershipFromNlp, md);

    const prestigeFromNlp = nlp.prestige;
    const prestigeScore = this.blendPrestige(prestigeFromNlp, car.segment);

    const reliabilityNlpRaw = nlp.reliability;
    const reliabilityScore = nn(reliabilityNlpRaw, 55);

    const performanceScore = this.blendPerformance(
      nlp.performance,
      car.specs?.horsepower,
    );

    const comfortScore = nn(nlp.comfort, 50);
    const economyScore = nn(nlp.economy, 50);

    const marketScore = marketFromData ?? 55;

    const {
      ownerSatisfactionTrend,
      ownerSatisfactionTrendScore,
    } = await this.computeOwnerSatisfactionTrendForCar(carId);

    const blend =
      options?.scoringBlend ??
      (await this.adaptive.getWeights(SCOPE_SCORING_BLEND));

    const riskScore = this.computeRiskScoreV2(
      {
        volatilityScore: md?.volatilityScore ?? null,
        liquidityScore: liquidity,
        depreciationRate: dep,
        reliabilityScore,
      },
      blend,
    );

    const reviewsCount = await this.prisma.carReviewsRaw.count({
      where: { carId },
    });
    const adsCount = md?.adsCount ?? 0;
    const popularityScore = computePopularityScore({
      adsCount,
      demandScore: demand,
      reviewsCount,
    });
    const ownerSatisfactionScore = computeOwnerSatisfactionScore(nlp);

    const predRow = await this.prisma.pricePrediction.findUnique({
      where: { carId },
    });
    const predCh30 =
      predRow?.predictedChange30d != null
        ? toNumber(predRow.predictedChange30d)
        : null;
    const invM = blend.investment ?? 1;
    const investmentScore = computeInvestmentScore({
      depreciationRate30d: dep,
      liquidityScore: liquidity,
      demandScore: demand,
      predictedChange30d: predCh30,
      blend: {
        dep: 0.25 * (blend.investment_dep ?? 1) * invM,
        liquidity: 0.25 * (blend.investment_liq ?? 1) * invM,
        demand: 0.25 * (blend.investment_demand ?? 1) * invM,
        pred: 0.25 * (blend.investment_pred ?? 1) * invM,
      },
    });

    const dims = {
      performanceScore,
      comfortScore,
      economyScore,
      reliabilityScore,
      marketScore,
      ownershipScore,
      prestigeScore,
      riskScore,
      popularityScore,
      ownerSatisfactionScore,
      ownerSatisfactionTrend,
      ownerSatisfactionTrendScore,
      investmentScore,
    };

    const liqSnap = await this.prisma.carLiquidityStats.findFirst({
      where: { carId },
      orderBy: { snapshotDate: 'desc' },
    });
    const cycleRow =
      car.segment?.trim() ?
        await this.prisma.marketCycle.findFirst({
          where: { segment: car.segment.trim() },
          orderBy: { snapshotDate: 'desc' },
        })
      : null;

    const timeToSellScore =
      liqSnap?.avgDaysToSell != null && liqSnap.avgDaysToSell > 0
        ? clamp(
            100 - liqSnap.avgDaysToSell * 1.12,
            0,
            100,
          )
        : 50;

    let cycleAdj = 0;
    if (cycleRow?.cycleType === 'BULL') {
      cycleAdj = 5 * (cycleRow.confidenceScore ?? 0.55);
    } else if (cycleRow?.cycleType === 'BEAR') {
      cycleAdj = -5 * (cycleRow.confidenceScore ?? 0.55);
    }

    const overallScore = this.computeOverallV3Adaptive(
      {
        performanceScore,
        economyScore,
        reliabilityScore,
        ownershipScore,
        marketScore,
        investmentScore,
        popularityScore,
        ownerSatisfactionScore,
        momentumScore: nn(md?.momentumScore, 50),
        liquidityTrendScore: nn(md?.liquidityTrendScore, 50),
        timeToSellScore,
        riskScore,
        cycleAdj,
      },
      blend,
    );

    const sel = await this.adaptive.getModelSelectionPayload();
    const ver =
      options?.modelVersionLabel ??
      `v3-adaptive::inv=${(sel.investmentScoreFormula as string) || 'v1'}::risk=${(sel.riskModelVersion as string) || 'v2'}`;

    await this.prisma.carScores.upsert({
      where: { carId },
      create: {
        carId,
        ...dims,
        overallScore,
        modelVersion: ver.slice(0, 120),
      },
      update: {
        ...dims,
        overallScore,
        modelVersion: ver.slice(0, 120),
      },
    });

    await this.ownershipCost.recomputeForCar(carId);

    this.logger.debug(`CarScores updated for ${carId}`);
  }

  async recomputeAll(): Promise<{ carsUpdated: number }> {
    const cars = await this.prisma.car.findMany({ select: { id: true } });
    const scoringBlend = await this.adaptive.getWeights(SCOPE_SCORING_BLEND);
    const sel = await this.adaptive.getModelSelectionPayload();
    const modelVersionLabel = `v3-adaptive::inv=${(sel.investmentScoreFormula as string) || 'v1'}::risk=${(sel.riskModelVersion as string) || 'v2'}`;
    for (const c of cars) {
      await this.recomputeForCar(c.id, { scoringBlend, modelVersionLabel });
    }
    this.logger.log(`CarScores recomputed for ${cars.length} cars`);
    return { carsUpdated: cars.length };
  }

  /** برای اندپوینت intelligence — بدون نوشتن DB */
  async buildIntelligenceSnapshot(carId: string) {
    const car = await this.prisma.car.findUnique({
      where: { id: carId },
      include: {
        specs: true,
        marketData: true,
        featureScores: true,
        scores: true,
        pricePrediction: true,
      },
    });
    if (!car) throw new NotFoundException(`Car ${carId} not found`);

    const nlpDims = aggregateNlpByDimension(car.featureScores);
    const md = car.marketData;
    const liquidity = md?.liquidityScore ?? null;
    const demand = md?.demandScore ?? null;
    const dep = md?.depreciationRate30d
      ? toNumber(md.depreciationRate30d)
      : null;

    const marketBlend = this.blendMarketScore(liquidity, demand);
    const ownershipNlp = nlpDims.ownership;
    const ownershipBlended = this.blendOwnership(ownershipNlp, md);
    const prestigeFromNlp = nlpDims.prestige;
    const prestigeBlended = this.blendPrestige(prestigeFromNlp, car.segment);
    const performanceBlended = this.blendPerformance(
      nlpDims.performance,
      car.specs?.horsepower,
    );
    const risk = this.computeRiskScoreV2(
      {
        volatilityScore: md?.volatilityScore ?? null,
        liquidityScore: liquidity,
        depreciationRate: dep,
        reliabilityScore: nn(nlpDims.reliability, 55),
      },
      await this.adaptive.getWeights(SCOPE_SCORING_BLEND),
    );

    const persisted = car.scores;

    return {
      carId: car.id,
      brand: car.brand,
      model: car.model,
      year: car.year,
      scores: persisted
        ? {
            performanceScore: persisted.performanceScore,
            comfortScore: persisted.comfortScore,
            economyScore: persisted.economyScore,
            reliabilityScore: persisted.reliabilityScore,
            marketScore: persisted.marketScore,
            ownershipScore: persisted.ownershipScore,
            prestigeScore: persisted.prestigeScore,
            riskScore: persisted.riskScore,
            overallScore: persisted.overallScore,
            popularityScore: persisted.popularityScore,
            ownerSatisfactionScore: persisted.ownerSatisfactionScore,
            ownerSatisfactionTrend: persisted.ownerSatisfactionTrend,
            ownerSatisfactionTrendScore:
              persisted.ownerSatisfactionTrendScore,
            investmentScore: persisted.investmentScore,
            updatedAt: persisted.updatedAt.toISOString(),
          }
        : null,
      pricePrediction: car.pricePrediction
        ? {
            predictedPrice30d: toNumber(car.pricePrediction.predictedPrice30d),
            predictedPrice90d: toNumber(car.pricePrediction.predictedPrice90d),
            predictedChange30d: toNumber(
              car.pricePrediction.predictedChange30d,
            ),
            predictedChange90d: toNumber(
              car.pricePrediction.predictedChange90d,
            ),
            confidence: car.pricePrediction.confidence,
            historyPointsUsed: car.pricePrediction.historyPointsUsed,
            methodology: car.pricePrediction.methodology,
            computedAt: car.pricePrediction.computedAt.toISOString(),
          }
        : null,
      breakdown: {
        nlpDimensions: nlpDims,
        nlpFeatureRows: car.featureScores.length,
        marketInputs: {
          liquidityScore: liquidity,
          demandScore: demand,
          depreciationRate30d: dep,
          blendedMarketPreview: marketBlend,
        },
        derived: {
          performanceWithSpecs: performanceBlended,
          ownershipBlended,
          ownershipFromNlpOnly: ownershipNlp,
          prestigeBlended,
          prestigeFromNlpOnly: prestigeFromNlp,
          riskModel: risk,
        },
      },
    };
  }

  private blendMarketScore(
    liquidity: number | null,
    demand: number | null,
  ): number | null {
    if (liquidity == null && demand == null) return null;
    const L = nn(liquidity, 50);
    const D = nn(demand, 50);
    return Math.round((0.55 * L + 0.45 * D) * 10) / 10;
  }

  private blendOwnership(
    nlpOwnership: number | null,
    md: { adsCount?: number; priceTrendScore?: number | null } | null,
  ): number {
    const base = nn(nlpOwnership, 52);
    let trendAdj = 0;
    if (md?.priceTrendScore != null) {
      trendAdj = clamp(15 * md.priceTrendScore, -12, 12);
    }
    const ads = md?.adsCount ?? 0;
    const supplyEase = clamp(Math.log10(ads + 1) * 4, 0, 15);
    return clamp(base + trendAdj * 0.3 + supplyEase * 0.15, 20, 95);
  }

  private blendPrestige(
    nlpPrestige: number | null,
    segment: string | null,
  ): number {
    let s = nn(nlpPrestige, 48);
    const seg = (segment ?? '').toLowerCase();
    if (/لوکس|پرمیوم|luxury|import|وارد/i.test(seg)) {
      s = Math.max(s, 72);
    }
    if (/اقتصادی|شهری|اقتصاد/i.test(seg)) {
      s = Math.min(s, 58);
    }
    return clamp(s, 15, 96);
  }

  private blendPerformance(
    nlpPerf: number | null,
    horsepower: number | null | undefined,
  ): number {
    let s = nn(nlpPerf, 50);
    if (horsepower != null && horsepower > 0) {
      const boost = clamp((horsepower - 90) / 4.5, -18, 28);
      s = clamp(s + boost * 0.35, 18, 96);
    }
    return Math.round(s * 10) / 10;
  }

  /**
   * ریسک v2: نوسان (معکوس)، افت قیمت، نقدشوندگی (معکوس)، اطمینان فنی از NLP (معکوس).
   */
  private computeRiskScoreV2(
    input: {
      volatilityScore: number | null;
      liquidityScore: number | null;
      depreciationRate: number | null;
      reliabilityScore: number;
    },
    blend: Record<string, number>,
  ): number {
    const vol = input.volatilityScore ?? 50;
    const liq = input.liquidityScore ?? 50;
    const rel = input.reliabilityScore;
    const depN = riskNormalizeDepreciation(input.depreciationRate);
    let cV = 0.35 * (blend.risk_vol ?? 1);
    let cD = 0.25 * (blend.risk_dep ?? 1);
    let cL = 0.2 * (blend.risk_liq ?? 1);
    let cR = 0.2 * (blend.risk_rel ?? 1);
    const s = cV + cD + cL + cR;
    if (s > 1e-9) {
      cV /= s;
      cD /= s;
      cL /= s;
      cR /= s;
    }
    const raw =
      cV * (100 - vol) +
      cD * depN +
      cL * (100 - liq) +
      cR * (100 - rel);
    return Math.round(clamp(raw, 0, 100) * 10) / 10;
  }

  private async computeOwnerSatisfactionTrendForCar(
    carId: string,
  ): Promise<{
    ownerSatisfactionTrend: string | null;
    ownerSatisfactionTrendScore: number | null;
  }> {
    const now = Date.now();
    const d90 = new Date(now - 90 * 86400000);
    const d180 = new Date(now - 180 * 86400000);
    const [recentRows, prevRows] = await Promise.all([
      this.prisma.carReviewsRaw.findMany({
        where: { carId, fetchedAt: { gte: d90 } },
        select: { text: true },
      }),
      this.prisma.carReviewsRaw.findMany({
        where: { carId, fetchedAt: { gte: d180, lt: d90 } },
        select: { text: true },
      }),
    ]);
    const textsR = recentRows.map((r) => r.text);
    const textsP = prevRows.map((r) => r.text);
    if (textsR.length < 2 || textsP.length < 2) {
      return {
        ownerSatisfactionTrend: null,
        ownerSatisfactionTrendScore: null,
      };
    }
    const sR = sentimentFromReviewTexts(textsR);
    const sP = sentimentFromReviewTexts(textsP);
    if (sR == null && sP == null) {
      return {
        ownerSatisfactionTrend: null,
        ownerSatisfactionTrendScore: null,
      };
    }
    const baseR = sR ?? 50;
    const baseP = sP ?? 50;
    const diff = baseR - baseP;
    const ownerSatisfactionTrendScore =
      Math.round(Math.max(-100, Math.min(100, diff * 2)) * 10) / 10;
    let ownerSatisfactionTrend: string;
    if (diff > 5) ownerSatisfactionTrend = 'RISING';
    else if (diff < -5) ownerSatisfactionTrend = 'FALLING';
    else ownerSatisfactionTrend = 'STABLE';
    return { ownerSatisfactionTrend, ownerSatisfactionTrendScore };
  }

  private computeOverall(d: {
    performanceScore: number;
    comfortScore: number;
    economyScore: number;
    reliabilityScore: number;
    marketScore: number;
    ownershipScore: number;
    prestigeScore: number;
    riskScore: number;
  }): number {
    let sum =
      d.performanceScore * OVERALL_WEIGHTS.performance +
      d.comfortScore * OVERALL_WEIGHTS.comfort +
      d.economyScore * OVERALL_WEIGHTS.economy +
      d.reliabilityScore * OVERALL_WEIGHTS.reliability +
      d.marketScore * OVERALL_WEIGHTS.market +
      d.ownershipScore * OVERALL_WEIGHTS.ownership +
      d.prestigeScore * OVERALL_WEIGHTS.prestige;
    sum -= RISK_PENALTY * d.riskScore;
    return Math.round(clamp(sum, 0, 100) * 10) / 10;
  }

  /** overallScore پویا با ضرایب تطبیقی از scoring_blend */
  private computeOverallV3Adaptive(
    d: {
      performanceScore: number;
      economyScore: number;
      reliabilityScore: number;
      ownershipScore: number;
      marketScore: number;
      investmentScore: number;
      popularityScore: number;
      ownerSatisfactionScore: number;
      momentumScore: number;
      liquidityTrendScore: number;
      timeToSellScore: number;
      riskScore: number;
      cycleAdj: number;
    },
    blend: Record<string, number>,
  ): number {
    const rows: Array<{
      val: number;
      base: number;
      key: keyof typeof blend | string;
    }> = [
      { val: d.performanceScore, base: 0.2, key: 'performance' },
      { val: d.economyScore, base: 0.15, key: 'economy' },
      { val: d.reliabilityScore, base: 0.15, key: 'reliability' },
      { val: d.ownershipScore, base: 0.1, key: 'ownership' },
      { val: d.marketScore, base: 0.1, key: 'market' },
      { val: d.investmentScore, base: 0.1, key: 'investment' },
      { val: d.popularityScore, base: 0.05, key: 'popularity' },
      { val: d.ownerSatisfactionScore, base: 0.05, key: 'ownerSatisfaction' },
      { val: d.momentumScore, base: 0.05, key: 'momentum' },
      { val: d.liquidityTrendScore, base: 0.03, key: 'liquidity' },
      { val: d.timeToSellScore, base: 0.02, key: 'time_to_sell' },
    ];
    let wSum = 0;
    let acc = 0;
    for (const r of rows) {
      const m = (blend[r.key as string] ?? 1) as number;
      const w = r.base * m;
      wSum += w;
      acc += w * r.val;
    }
    let sum = wSum > 1e-9 ? acc / wSum : acc;
    sum += d.cycleAdj;
    sum -=
      RISK_PENALTY_OVERALL_V3 * (blend.risk ?? 1) * d.riskScore;
    return Math.round(clamp(sum, 0, 100) * 10) / 10;
  }
}
