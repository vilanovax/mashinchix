import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LearningModule } from '../learning/learning.module';
import { PricePredictionService } from './price-prediction.service';
import { SegmentMarketIndexService } from './segment-market-index.service';

@Module({
  imports: [PrismaModule, LearningModule],
  providers: [PricePredictionService, SegmentMarketIndexService],
  exports: [PricePredictionService, SegmentMarketIndexService],
})
export class PredictionModule {}
