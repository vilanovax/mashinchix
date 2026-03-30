import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsController } from './analytics.controller';
import { BehaviorAnalyticsService } from './behavior-analytics.service';
import { MarketAnalyticsService } from './market-analytics.service';
import { RecommendationAnalyticsService } from './recommendation-analytics.service';
import { DynamicIntelligenceAnalyticsService } from './dynamic-intelligence-analytics.service';
import { MarketIntelligenceAnalyticsService } from './market-intelligence-analytics.service';
import { MarketReportService } from './market-report.service';
import { BacktestingModule } from '../backtesting/backtesting.module';
import { ModelEvaluationModule } from '../model-evaluation/model-evaluation.module';

@Module({
  imports: [PrismaModule, BacktestingModule, ModelEvaluationModule],
  controllers: [AnalyticsController],
  providers: [
    MarketAnalyticsService,
    BehaviorAnalyticsService,
    RecommendationAnalyticsService,
    DynamicIntelligenceAnalyticsService,
    MarketIntelligenceAnalyticsService,
    MarketReportService,
  ],
  exports: [
    MarketAnalyticsService,
    DynamicIntelligenceAnalyticsService,
    MarketIntelligenceAnalyticsService,
    MarketReportService,
  ],
})
export class AnalyticsModule {}
