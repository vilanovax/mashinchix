import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ScenarioSimulationService } from './scenario-simulation.service';
import { StressTestService } from './stress-test.service';
import { StrategyScenarioService } from './strategy-scenario.service';
import { ScenarioAnalyticsService } from './scenario-analytics.service';
import { ScenarioController } from './scenario.controller';
import { ScenarioAnalyticsController } from './scenario-analytics.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ScenarioController, ScenarioAnalyticsController],
  providers: [
    ScenarioSimulationService,
    StressTestService,
    StrategyScenarioService,
    ScenarioAnalyticsService,
  ],
  exports: [
    ScenarioSimulationService,
    StressTestService,
    StrategyScenarioService,
    ScenarioAnalyticsService,
  ],
})
export class ScenarioModule {}
