import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PortfolioRecommendationService } from './portfolio-recommendation.service';
import { StrategyAdvisorService } from './strategy-advisor.service';
import { PortfolioAnalyticsService } from './portfolio-analytics.service';
import { PortfolioController } from './portfolio.controller';
import { PortfolioAnalyticsController } from './portfolio-analytics.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PortfolioController, PortfolioAnalyticsController],
  providers: [
    PortfolioRecommendationService,
    StrategyAdvisorService,
    PortfolioAnalyticsService,
  ],
  exports: [
    PortfolioRecommendationService,
    StrategyAdvisorService,
    PortfolioAnalyticsService,
  ],
})
export class PortfolioModule {}
