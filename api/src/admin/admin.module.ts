import { Module } from '@nestjs/common';
import { NlpModule } from '../nlp/nlp.module';
import { ReviewsIngestionService } from '../reviews/reviews-ingestion.service';
import { MarketModule } from '../market/market.module';
import { ScoresModule } from '../scores/scores.module';
import { AdminController } from './admin.controller';
import { DataQualityAdminController } from './data-quality-admin.controller';

@Module({
  imports: [ScoresModule, MarketModule, NlpModule],
  controllers: [AdminController, DataQualityAdminController],
  providers: [ReviewsIngestionService],
})
export class AdminModule {}
