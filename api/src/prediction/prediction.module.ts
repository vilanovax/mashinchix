import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PricePredictionService } from './price-prediction.service';
import { SegmentMarketIndexService } from './segment-market-index.service';

@Module({
  imports: [PrismaModule],
  providers: [PricePredictionService, SegmentMarketIndexService],
  exports: [PricePredictionService, SegmentMarketIndexService],
})
export class PredictionModule {}
