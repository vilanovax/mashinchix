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
import { CarLiquidityStatsService } from './car-liquidity-stats.service';
import { MarketCycleService } from './market-cycle.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: DATA_PLATFORM_QUEUE,
    }),
    ScoringModule,
    PredictionModule,
    TrackingModule,
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
