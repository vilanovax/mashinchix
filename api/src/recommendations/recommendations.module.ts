import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TrackingModule } from '../tracking/tracking.module';
import { RecommendationService } from './recommendation.service';
import { RecommendationsController } from './recommendations.controller';

@Module({
  imports: [PrismaModule, TrackingModule],
  controllers: [RecommendationsController],
  providers: [RecommendationService],
})
export class RecommendationsModule {}
