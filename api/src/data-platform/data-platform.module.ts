import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PredictionModule } from '../prediction/prediction.module';
import { ScoringModule } from '../scoring/scoring.module';
import { DATA_PLATFORM_QUEUE } from './data-platform.constants';
import { ListingMatcherService } from './listing-matcher.service';
import { DivarScraperService } from '../scrapers/divar/divar-scraper.service';
import { AggregatePriceHistoryService } from './aggregate-price-history.service';
import { MarketMetricsService } from './market-metrics.service';
import { BuySellSignalService } from './buy-sell-signal.service';
import { ListingCleaningService } from './listing-cleaning.service';
import { DataPlatformProcessor } from './data-platform.processor';
import { DataPlatformScheduler } from './data-platform.scheduler';
import { DataPlatformAdminController } from './data-platform-admin.controller';
import { TrackingModule } from '../tracking/tracking.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { IntelligenceDeliveryModule } from '../delivery/intelligence-delivery.module';
import { CarLiquidityStatsService } from './car-liquidity-stats.service';
import { MarketCycleService } from './market-cycle.service';
import { MarketInsightsService } from './market-insights.service';
import { MarketAlertsService } from './market-alerts.service';
import { ModelEvaluationModule } from '../model-evaluation/model-evaluation.module';
import { TriggersModule } from '../triggers/triggers.module';
import { LearningModule } from '../learning/learning.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: DATA_PLATFORM_QUEUE,
    }),
    ScoringModule,
    PredictionModule,
    TrackingModule,
    AnalyticsModule,
    IntelligenceDeliveryModule,
    ModelEvaluationModule,
    TriggersModule,
    LearningModule,
  ],
  controllers: [DataPlatformAdminController],
  providers: [
    ListingMatcherService,
    ListingCleaningService,
    DivarScraperService,
    AggregatePriceHistoryService,
    MarketMetricsService,
    CarLiquidityStatsService,
    MarketCycleService,
    BuySellSignalService,
    MarketInsightsService,
    MarketAlertsService,
    DataPlatformProcessor,
    DataPlatformScheduler,
  ],
  exports: [
    DivarScraperService,
    AggregatePriceHistoryService,
    MarketMetricsService,
    ListingCleaningService,
  ],
})
export class DataPlatformModule {}
