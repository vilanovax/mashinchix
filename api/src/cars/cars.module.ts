import { Module } from '@nestjs/common';
import { CarsController } from './cars.controller';
import { CarsService } from './cars.service';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { PriceHistoryModule } from '../price-history/price-history.module';
import { ScoringModule } from '../scoring/scoring.module';
import { BuySellSignalService } from '../data-platform/buy-sell-signal.service';

@Module({
  imports: [PriceHistoryModule, ScoringModule, IntelligenceModule],
  controllers: [CarsController],
  providers: [CarsService, BuySellSignalService],
  exports: [CarsService, BuySellSignalService],
})
export class CarsModule {}
