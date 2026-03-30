import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CarsModule } from '../cars/cars.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { ScoringModule } from '../scoring/scoring.module';
import { PublicController } from './public.controller';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeyService } from './api-key.service';

@Module({
  imports: [CarsModule, ScoringModule, IntelligenceModule, AnalyticsModule],
  controllers: [PublicController],
  providers: [ApiKeyService, ApiKeyGuard],
})
export class PublicModule {}
