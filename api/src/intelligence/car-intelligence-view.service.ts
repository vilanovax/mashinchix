import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';

export type CarIntelligenceViewRow = {
  car_id: string;
  brand: string;
  model: string;
  year: number;
  segment: string | null;
  performanceScore: number | null;
  comfortScore: number | null;
  economyScore: number | null;
  reliabilityScore: number | null;
  marketScore: number | null;
  ownershipScore: number | null;
  prestigeScore: number | null;
  riskScore: number | null;
  overallScore: number | null;
  popularityScore: number | null;
  ownerSatisfactionScore: number | null;
  ownerSatisfactionTrend: string | null;
  ownerSatisfactionTrendScore: number | null;
  investmentScore: number | null;
  adsCount: number | null;
  avgPrice: unknown;
  minPrice: unknown;
  maxPrice: unknown;
  liquidityScore: number | null;
  demandScore: number | null;
  depreciationRate30d: unknown;
  priceTrendLabel: string | null;
  priceTrendScore: number | null;
  volatilityScore: number | null;
  volatilityRaw: unknown;
  popularityTrend: string | null;
  popularityTrendScore: number | null;
  buyScore: number | null;
  sellScore: number | null;
  marketSignal: string | null;
  reviewsCount: number | null;
  priceHistoryPoints: number | null;
  lastPrice: unknown;
  fuelMonthlyTomans: unknown;
  maintenanceYearlyTomans: unknown;
  depreciationAnnualRate: unknown;
  predictedPrice30d: unknown;
  predictedPrice90d: unknown;
  predictedChange30d: unknown;
  predictedChange90d: unknown;
  predictionConfidence: number | null;
  predictionHistoryPoints: number | null;
  scores_model_version: string | null;
  priceChange7d: unknown;
  priceChange90d: unknown;
  momentumScore: number | null;
  listingsLast7d: number | null;
  listingsPrev7d: number | null;
  listingsLast30d: number | null;
  listingsPrev30d: number | null;
  liquidityTrendScore: number | null;
  liquidityTrendLabel: string | null;
  volatilityTrendScore: number | null;
  volatilityTrendLabel: string | null;
  liquidity_avg_days_to_sell: number | null;
  liquidity_median_days_to_sell: number | null;
  liquidity_sell_through_rate: number | null;
  market_cycle_type: string | null;
  market_cycle_confidence: number | null;
};

@Injectable()
export class CarIntelligenceViewService {
  constructor(private readonly prisma: PrismaService) {}

  async getRow(carId: string): Promise<CarIntelligenceViewRow | null> {
    const rows = await this.prisma.$queryRaw<CarIntelligenceViewRow[]>`
      SELECT * FROM car_intelligence_view WHERE car_id = ${carId}
    `;
    return rows[0] ?? null;
  }

  async getRowOrThrow(carId: string): Promise<CarIntelligenceViewRow> {
    const row = await this.getRow(carId);
    if (!row) throw new NotFoundException(`No intelligence row for ${carId}`);
    return row;
  }

  /** نسخهٔ JSON-safe برای API */
  serialize(row: CarIntelligenceViewRow) {
    return {
      ...row,
      avgPrice: toNumber(row.avgPrice as never),
      minPrice: toNumber(row.minPrice as never),
      maxPrice: toNumber(row.maxPrice as never),
      depreciationRate30d: toNumber(row.depreciationRate30d as never),
      lastPrice: toNumber(row.lastPrice as never),
      fuelMonthlyTomans: toNumber(row.fuelMonthlyTomans as never),
      maintenanceYearlyTomans: toNumber(row.maintenanceYearlyTomans as never),
      depreciationAnnualRate: toNumber(row.depreciationAnnualRate as never),
      predictedPrice30d: toNumber(row.predictedPrice30d as never),
      predictedPrice90d: toNumber(row.predictedPrice90d as never),
      predictedChange30d: toNumber(row.predictedChange30d as never),
      predictedChange90d: toNumber(row.predictedChange90d as never),
      volatilityRaw: toNumber(row.volatilityRaw as never),
      priceChange7d: toNumber(row.priceChange7d as never),
      priceChange90d: toNumber(row.priceChange90d as never),
      scoresModelVersion: row.scores_model_version ?? null,
      momentumScore: row.momentumScore,
      liquidityTrendScore: row.liquidityTrendScore,
      liquidityTrendLabel: row.liquidityTrendLabel,
      volatilityTrendScore: row.volatilityTrendScore,
      volatilityTrendLabel: row.volatilityTrendLabel,
      liquidityAvgDaysToSell: row.liquidity_avg_days_to_sell,
      liquidityMedianDaysToSell: row.liquidity_median_days_to_sell,
      liquiditySellThroughRate: row.liquidity_sell_through_rate,
      marketCycleType: row.market_cycle_type,
      marketCycleConfidence: row.market_cycle_confidence,
    };
  }
}
