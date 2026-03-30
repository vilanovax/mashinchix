import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BacktestingService } from './backtesting.service';
import { PortfolioSimulationService } from './portfolio-simulation.service';
import { RecommendationEvaluationService } from './recommendation-evaluation.service';

@Module({
  imports: [PrismaModule],
  providers: [
    BacktestingService,
    PortfolioSimulationService,
    RecommendationEvaluationService,
  ],
  exports: [
    BacktestingService,
    PortfolioSimulationService,
    RecommendationEvaluationService,
  ],
})
export class BacktestingModule {}
