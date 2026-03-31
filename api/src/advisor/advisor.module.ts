import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { ExecutionModule } from '../execution/execution.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { DecisionModule } from '../decision/decision.module';
import { ScenarioModule } from '../scenario/scenario.module';
import { LearningModule } from '../learning/learning.module';
import { TriggersModule } from '../triggers/triggers.module';
import { UserBehaviorModule } from '../user-behavior/user-behavior.module';
import { AdvisorController } from './advisor.controller';
import { UserActionPlanService } from './user-action-plan.service';
import { AdvisorNarrativeService } from './advisor-narrative.service';
import { AdvisorPriorityService } from './advisor-priority.service';
import { AdvisorImpactService } from './advisor-impact.service';
import { AdvisorHistoryService } from './advisor-history.service';

@Module({
  imports: [
    PrismaModule,
    IntelligenceModule,
    ExecutionModule,
    PortfolioModule,
    DecisionModule,
    ScenarioModule,
    LearningModule,
    TriggersModule,
    UserBehaviorModule,
  ],
  controllers: [AdvisorController],
  providers: [
    UserActionPlanService,
    AdvisorNarrativeService,
    AdvisorPriorityService,
    AdvisorImpactService,
    AdvisorHistoryService,
  ],
  exports: [UserActionPlanService, AdvisorHistoryService],
})
export class AdvisorModule {}
