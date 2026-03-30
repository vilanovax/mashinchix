import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { AlertSeverity, InsightType, MarketReportFrequency } from '@prisma/client';
import { BehaviorAnalyticsService } from './behavior-analytics.service';
import { MarketAnalyticsService } from './market-analytics.service';
import { RecommendationAnalyticsService } from './recommendation-analytics.service';
import { DynamicIntelligenceAnalyticsService } from './dynamic-intelligence-analytics.service';
import { MarketIntelligenceAnalyticsService } from './market-intelligence-analytics.service';
import { MarketReportService } from './market-report.service';
import { BacktestingService } from '../backtesting/backtesting.service';
import { PortfolioSimulationService } from '../backtesting/portfolio-simulation.service';
import { RecommendationEvaluationService } from '../backtesting/recommendation-evaluation.service';
import { ModelAnalyticsService } from '../model-evaluation/model-analytics.service';
import {
  RunBacktestDto,
  RunPortfolioSimulationDto,
} from './dto/run-backtest.dto';
import { BacktestStrategyName } from '@prisma/client';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly market: MarketAnalyticsService,
    private readonly behavior: BehaviorAnalyticsService,
    private readonly recommendationAnalytics: RecommendationAnalyticsService,
    private readonly dynamicIntel: DynamicIntelligenceAnalyticsService,
    private readonly intelligence: MarketIntelligenceAnalyticsService,
    private readonly reports: MarketReportService,
    private readonly backtesting: BacktestingService,
    private readonly portfolioSimulation: PortfolioSimulationService,
    private readonly recommendationEvaluation: RecommendationEvaluationService,
    private readonly modelAnalytics: ModelAnalyticsService,
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

  @Get('models/prediction-performance')
  modelsPredictionPerformance() {
    return this.modelAnalytics.predictionPerformance();
  }

  @Get('models/investment-performance')
  modelsInvestmentPerformance() {
    return this.modelAnalytics.investmentPerformance();
  }

  @Get('models/risk-performance')
  modelsRiskPerformance() {
    return this.modelAnalytics.riskPerformance();
  }

  @Get('models/recommendation-performance')
  modelsRecommendationPerformance() {
    return this.modelAnalytics.recommendationPerformance();
  }

  @Get('models/version-comparison')
  modelsVersionComparison() {
    return this.modelAnalytics.versionComparison();
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

  @Get('insights/latest')
  insightsLatest(
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('snapshotDate') snapshotDate?: string,
  ) {
    const l = limit != null ? parseInt(limit, 10) : 80;
    let insightType: InsightType | undefined;
    if (type && Object.values(InsightType).includes(type as InsightType)) {
      insightType = type as InsightType;
    } else if (type) {
      throw new BadRequestException('نوع insight نامعتبر است');
    }
    return this.intelligence.latestInsights({
      limit: Number.isFinite(l) ? l : 80,
      insightType,
      snapshotDate,
    });
  }

  @Get('insights/cars')
  insightsCars(
    @Query('limit') limit?: string,
    @Query('snapshotDate') snapshotDate?: string,
  ) {
    const l = limit != null ? parseInt(limit, 10) : 60;
    return this.intelligence.insightsCars({
      limit: Number.isFinite(l) ? l : 60,
      snapshotDate,
    });
  }

  @Get('insights/segments')
  insightsSegments(
    @Query('limit') limit?: string,
    @Query('snapshotDate') snapshotDate?: string,
  ) {
    const l = limit != null ? parseInt(limit, 10) : 40;
    return this.intelligence.insightsSegments({
      limit: Number.isFinite(l) ? l : 40,
      snapshotDate,
    });
  }

  @Get('alerts')
  marketAlerts(
    @Query('limit') limit?: string,
    @Query('severity') severity?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const l = limit != null ? parseInt(limit, 10) : 100;
    let sev: AlertSeverity | undefined;
    if (
      severity &&
      Object.values(AlertSeverity).includes(severity as AlertSeverity)
    ) {
      sev = severity as AlertSeverity;
    } else if (severity) {
      throw new BadRequestException('severity نامعتبر است');
    }
    return this.intelligence.alerts({
      limit: Number.isFinite(l) ? l : 100,
      severity: sev,
      activeOnly: includeInactive === 'true' ? false : true,
    });
  }

  @Get('opportunities')
  opportunities(
    @Query('limit') limit?: string,
    @Query('snapshotDate') snapshotDate?: string,
  ) {
    const l = limit != null ? parseInt(limit, 10) : 50;
    return this.intelligence.opportunities({
      limit: Number.isFinite(l) ? l : 50,
      snapshotDate,
    });
  }

  @Get('market/report')
  marketIntelligenceReport() {
    return this.intelligence.marketReport();
  }

  @Get('reports/latest')
  reportsLatest(@Query('frequency') frequency?: string) {
    const f =
      frequency === 'WEEKLY'
        ? MarketReportFrequency.WEEKLY
        : MarketReportFrequency.DAILY;
    return this.reports.latestReport(f);
  }

  @Get('reports/history')
  reportsHistory(
    @Query('limit') limit?: string,
    @Query('frequency') frequency?: string,
  ) {
    const l = limit != null ? parseInt(limit, 10) : 20;
    const f =
      frequency === 'DAILY'
        ? MarketReportFrequency.DAILY
        : frequency === 'WEEKLY'
          ? MarketReportFrequency.WEEKLY
          : undefined;
    return this.reports.history({
      limit: Number.isFinite(l) ? l : 20,
      frequency: f,
    });
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

  @Get('strategies/backtests')
  listBacktests(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 50;
    return this.backtesting.listBacktests(Number.isFinite(l) ? l : 50);
  }

  @Get('strategies/best')
  bestStrategies(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 10;
    return this.backtesting.bestStrategies(Number.isFinite(l) ? l : 10);
  }

  @Post('strategies/backtest')
  runBacktest(@Body() dto: RunBacktestDto) {
    if (dto.strategy === BacktestStrategyName.RECOMMENDATION_HISTORICAL_EVAL) {
      throw new BadRequestException(
        'برای ارزیابی توصیه از POST /analytics/recommendations/evaluation یا همان GET استفاده کنید',
      );
    }
    return this.backtesting.runBacktest(
      dto.strategy,
      dto.startDate,
      dto.endDate,
    );
  }

  @Get('portfolio/simulations')
  listSimulations(
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
  ) {
    const l = limit != null ? parseInt(limit, 10) : 40;
    return this.portfolioSimulation.listSimulations(
      Number.isFinite(l) ? l : 40,
      userId,
    );
  }

  @Post('portfolio/simulation')
  runSimulation(@Body() dto: RunPortfolioSimulationDto) {
    return this.portfolioSimulation.runSimulation({
      strategy: dto.strategy,
      startDate: dto.startDate,
      endDate: dto.endDate,
      initialCapital: dto.initialCapital,
      userId: dto.userId,
    });
  }

  @Get('portfolio/performance')
  portfolioPerformance() {
    return this.portfolioSimulation.performanceSummary();
  }

  @Get('recommendations/evaluation')
  async recommendationHistoricalEvaluation(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('persist') persist?: string,
  ) {
    const endDt = end ? new Date(end) : new Date();
    const startDt = start
      ? new Date(start)
      : new Date(endDt.getTime() - 180 * 86400000);
    if (Number.isNaN(startDt.getTime()) || Number.isNaN(endDt.getTime())) {
      throw new BadRequestException('تاریخ start/end نامعتبر است');
    }
    return this.recommendationEvaluation.evaluateHistorically(
      startDt,
      endDt,
      persist === 'true' || persist === '1',
    );
  }
}
