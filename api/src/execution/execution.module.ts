import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { LearningModule } from '../learning/learning.module';
import { ScenarioModule } from '../scenario/scenario.module';
import { ExecutionEngineService } from './execution-engine.service';
import { PortfolioAutoRebalanceService } from './portfolio-auto-rebalance.service';
import { ExecutionSimulationService } from './execution-simulation.service';
import { ExecutionPolicyService } from './execution-policy.service';
import { ExecutionPerformanceService } from './execution-performance.service';
import { ExecutionRunService } from './execution-run.service';
import { ExecutionController } from './execution.controller';

@Module({
  imports: [
    PrismaModule,
    IntelligenceModule,
    PortfolioModule,
    LearningModule,
    ScenarioModule,
  ],
  controllers: [ExecutionController],
  providers: [
    ExecutionEngineService,
    PortfolioAutoRebalanceService,
    ExecutionSimulationService,
    ExecutionPolicyService,
    ExecutionPerformanceService,
    ExecutionRunService,
  ],
  exports: [
    ExecutionEngineService,
    PortfolioAutoRebalanceService,
    ExecutionSimulationService,
    ExecutionRunService,
    ExecutionPerformanceService,
  ],
})
export class ExecutionModule {}
