import { Module } from '@nestjs/common';
import { ComparisonService } from './comparison.service';
import { ComparisonsController } from './comparisons.controller';

@Module({
  controllers: [ComparisonsController],
  providers: [ComparisonService],
  exports: [ComparisonService],
})
export class ComparisonsModule {}
