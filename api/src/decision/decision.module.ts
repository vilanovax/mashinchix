import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { LearningModule } from '../learning/learning.module';
import { DecisionEngineService } from './decision-engine.service';
import { AdvisorExplanationService } from './advisor-explanation.service';
import { DecisionController } from './decision.controller';

@Module({
  imports: [PrismaModule, PortfolioModule, LearningModule],
  controllers: [DecisionController],
  providers: [DecisionEngineService, AdvisorExplanationService],
  exports: [DecisionEngineService, AdvisorExplanationService],
})
export class DecisionModule {}
