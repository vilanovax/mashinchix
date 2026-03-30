import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BehaviorMetricsService } from './behavior-metrics.service';
import { EventsController } from './events.controller';
import { RecommendationFeedbackService } from './recommendation-feedback.service';
import { RecommendationSessionService } from './recommendation-session.service';
import { UserEventsService } from './user-events.service';
import { UserPreferenceLearningService } from './user-preference-learning.service';

@Module({
  imports: [PrismaModule],
  controllers: [EventsController],
  providers: [
    UserEventsService,
    RecommendationFeedbackService,
    RecommendationSessionService,
    BehaviorMetricsService,
    UserPreferenceLearningService,
  ],
  exports: [
    RecommendationSessionService,
    BehaviorMetricsService,
    UserPreferenceLearningService,
    UserEventsService,
  ],
})
export class TrackingModule {}
