import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TrackingModule } from '../tracking/tracking.module';
import { GraphModule } from '../graph/graph.module';
import { RecommendationService } from './recommendation.service';
import { RecommendationsController } from './recommendations.controller';

@Module({
  imports: [PrismaModule, TrackingModule, GraphModule],
  controllers: [RecommendationsController],
  providers: [RecommendationService],
})
export class RecommendationsModule {}
