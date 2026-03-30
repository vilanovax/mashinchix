import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { BehaviorAnalyticsService } from './behavior-analytics.service';
import { MarketAnalyticsService } from './market-analytics.service';
import { RecommendationAnalyticsService } from './recommendation-analytics.service';
import { DynamicIntelligenceAnalyticsService } from './dynamic-intelligence-analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly market: MarketAnalyticsService,
    private readonly behavior: BehaviorAnalyticsService,
    private readonly recommendationAnalytics: RecommendationAnalyticsService,
    private readonly dynamicIntel: DynamicIntelligenceAnalyticsService,
  ) {}

  @Get('market/overview')
  marketOverview() {
    return this.market.overview();
  }

  @Get('market/segments')
  marketSegments() {
    return this.market.segmentBreakdown();
  }

  @Get('market/price-trends')
  priceTrends() {
    return this.market.priceTrendDistribution();
  }

  @Get('market/depreciation')
  marketDepreciation() {
    return this.market.depreciationSummary();
  }

  @Get('market/predictions/summary')
  predictionsSummary() {
    return this.market.predictionsSummary();
  }

  @Get('market/segment-index')
  segmentIndexLatest() {
    return this.market.latestSegmentIndices();
  }

  @Get('behavior/overview')
  behaviorOverview() {
    return this.behavior.overview();
  }

  @Get('behavior/cars')
  behaviorCars(@Query('days') days?: string) {
    const d = days != null ? parseInt(days, 10) : 30;
    return this.behavior.topCars(Number.isFinite(d) ? d : 30);
  }

  @Get('behavior/users/:userId')
  behaviorUser(@Param('userId') userId: string) {
    return this.behavior.userBehavior(userId);
  }

  @Get('recommendations/performance')
  recommendationsPerformance() {
    return this.recommendationAnalytics.recommendationPerformance();
  }

  @Get('market/cycles')
  marketCycles(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 60;
    return this.dynamicIntel.marketCycles(Number.isFinite(l) ? l : 60);
  }

  @Get('market/momentum')
  marketMomentum(@Query('top') top?: string) {
    const t = top != null ? parseInt(top, 10) : 25;
    return this.dynamicIntel.marketMomentum(Number.isFinite(t) ? t : 25);
  }

  @Get('market/liquidity-trends')
  marketLiquidityTrends(@Query('top') top?: string) {
    const t = top != null ? parseInt(top, 10) : 25;
    return this.dynamicIntel.marketLiquidityTrends(Number.isFinite(t) ? t : 25);
  }

  @Get('cars/intelligence-top')
  carsIntelligenceTop(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 30;
    return this.dynamicIntel.intelligenceTop(Number.isFinite(l) ? l : 30);
  }

  @Get('cars/high-risk')
  carsHighRisk(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 30;
    return this.dynamicIntel.highRisk(Number.isFinite(l) ? l : 30);
  }

  @Get('cars/best-investment')
  carsBestInvestment(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 30;
    return this.dynamicIntel.bestInvestment(Number.isFinite(l) ? l : 30);
  }

  @Get('cars/fastest-selling')
  carsFastestSelling(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 30;
    return this.dynamicIntel.fastestSelling(Number.isFinite(l) ? l : 30);
  }

  @Get('market/segment-index/history')
  segmentIndexHistory(
    @Query('segment') segment: string,
    @Query('days') days?: string,
  ) {
    if (!segment?.trim()) {
      throw new BadRequestException('پارامتر segment الزامی است');
    }
    const d = days != null ? parseInt(days, 10) : 90;
    return this.market.segmentIndexHistory(
      segment.trim(),
      Number.isFinite(d) ? d : 90,
    );
  }
}
