import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketCorrelationService } from './market-correlation.service';
import { CarSubstitutionService } from './car-substitution.service';
import { GraphAnalyticsService } from './graph-analytics.service';
import { RecommendationGraphEnrichmentService } from './recommendation-graph.enrichment';
import { GraphController } from './graph.controller';

@Module({
  imports: [PrismaModule],
  controllers: [GraphController],
  providers: [
    MarketCorrelationService,
    CarSubstitutionService,
    GraphAnalyticsService,
    RecommendationGraphEnrichmentService,
  ],
  exports: [
    MarketCorrelationService,
    CarSubstitutionService,
    GraphAnalyticsService,
    RecommendationGraphEnrichmentService,
  ],
})
export class GraphModule {}
