import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { WatchlistController } from './watchlist.controller';
import { WatchlistService } from './watchlist.service';
import { UserNotificationService } from './user-notification.service';
import { PersonalizedInsightsService } from './personalized-insights.service';

@Module({
  imports: [AnalyticsModule],
  controllers: [WatchlistController],
  providers: [
    WatchlistService,
    UserNotificationService,
    PersonalizedInsightsService,
  ],
  exports: [
    WatchlistService,
    UserNotificationService,
    PersonalizedInsightsService,
  ],
})
export class IntelligenceDeliveryModule {}
