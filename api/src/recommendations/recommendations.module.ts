import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TrackingModule } from '../tracking/tracking.module';
import { GraphModule } from '../graph/graph.module';
import { LearningModule } from '../learning/learning.module';
import { RecommendationService } from './recommendation.service';
import { RecommendationsController } from './recommendations.controller';

@Module({
  imports: [PrismaModule, TrackingModule, GraphModule, LearningModule],
  controllers: [RecommendationsController],
  providers: [RecommendationService],
})
export class RecommendationsModule {}
