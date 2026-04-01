import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { DecisionModule } from '../decision/decision.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { ScenarioModule } from '../scenario/scenario.module';
import { IntelligenceOverviewService } from './intelligence-overview.service';
import { IntelligenceBriefingService } from './intelligence-briefing.service';
import { IntelligenceController } from './intelligence.controller';
import { MeController } from './me.controller';
import { OwnershipCostService } from './ownership-cost.service';
import { CarIntelligenceViewService } from './car-intelligence-view.service';

@Module({
  imports: [
    PrismaModule,
    AnalyticsModule,
    DecisionModule,
    PortfolioModule,
    ScenarioModule,
  ],
  controllers: [IntelligenceController, MeController],
  providers: [
    IntelligenceOverviewService,
    IntelligenceBriefingService,
    OwnershipCostService,
    CarIntelligenceViewService,
  ],
  exports: [
    IntelligenceOverviewService,
    IntelligenceBriefingService,
    OwnershipCostService,
    CarIntelligenceViewService,
  ],
})
export class IntelligenceModule {}
