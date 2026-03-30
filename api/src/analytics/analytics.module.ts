import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsController } from './analytics.controller';
import { BehaviorAnalyticsService } from './behavior-analytics.service';
import { MarketAnalyticsService } from './market-analytics.service';
import { RecommendationAnalyticsService } from './recommendation-analytics.service';
import { DynamicIntelligenceAnalyticsService } from './dynamic-intelligence-analytics.service';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [
    MarketAnalyticsService,
    BehaviorAnalyticsService,
    RecommendationAnalyticsService,
    DynamicIntelligenceAnalyticsService,
  ],
})
export class AnalyticsModule {}
