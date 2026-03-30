import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CarsModule } from './cars/cars.module';
import { UserProfileModule } from './user-profile/user-profile.module';
import { ComparisonsModule } from './comparisons/comparisons.module';
import { DataPlatformModule } from './data-platform/data-platform.module';
import { MarketModule } from './market/market.module';
import { PriceHistoryModule } from './price-history/price-history.module';
import { PrismaModule } from './prisma/prisma.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { ScoresModule } from './scores/scores.module';
import { TrackingModule } from './tracking/tracking.module';

const bullDisabled = process.env.DISABLE_BULLMQ === 'true';

const queueImports = bullDisabled
  ? []
  : [
      BullModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (config: ConfigService) => ({
          connection: new IORedis(
            config.get<string>('REDIS_URL', 'redis://127.0.0.1:6379'),
            { maxRetriesPerRequest: null },
          ),
        }),
        inject: [ConfigService],
      }),
      DataPlatformModule,
    ];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ...queueImports,
    PrismaModule,
    PriceHistoryModule,
    CarsModule,
    MarketModule,
    ScoresModule,
    ComparisonsModule,
    RecommendationsModule,
    TrackingModule,
    AdminModule,
    AnalyticsModule,
    UserProfileModule,
  ],
})
export class AppModule {}
