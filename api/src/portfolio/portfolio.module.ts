import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LearningModule } from '../learning/learning.module';
import { PortfolioRecommendationService } from './portfolio-recommendation.service';
import { StrategyAdvisorService } from './strategy-advisor.service';
import { PortfolioAnalyticsService } from './portfolio-analytics.service';
import { PortfolioController } from './portfolio.controller';
import { PortfolioAnalyticsController } from './portfolio-analytics.controller';
import { PortfolioOptimizationController } from './portfolio-optimization.controller';
import { PortfolioOptimizationService } from './portfolio-optimization.service';
import { PortfolioRebalancingService } from './portfolio-rebalancing.service';
import { PortfolioLedgerService } from './portfolio-ledger.service';
import { PortfolioPerformanceService } from './portfolio-performance.service';

@Module({
  imports: [PrismaModule, LearningModule],
  controllers: [
    PortfolioController,
    PortfolioAnalyticsController,
    PortfolioOptimizationController,
  ],
  providers: [
    PortfolioRecommendationService,
    StrategyAdvisorService,
    PortfolioAnalyticsService,
    PortfolioOptimizationService,
    PortfolioRebalancingService,
    PortfolioLedgerService,
    PortfolioPerformanceService,
  ],
  exports: [
    PortfolioRecommendationService,
    StrategyAdvisorService,
    PortfolioAnalyticsService,
    PortfolioOptimizationService,
    PortfolioRebalancingService,
    PortfolioLedgerService,
    PortfolioPerformanceService,
  ],
})
export class PortfolioModule {}
