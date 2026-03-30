import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { DecisionEngineService } from './decision-engine.service';
import { AdvisorExplanationService } from './advisor-explanation.service';
import { DecisionController } from './decision.controller';

@Module({
  imports: [PrismaModule, PortfolioModule],
  controllers: [DecisionController],
  providers: [DecisionEngineService, AdvisorExplanationService],
  exports: [DecisionEngineService, AdvisorExplanationService],
})
export class DecisionModule {}
