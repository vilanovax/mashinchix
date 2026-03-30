import { Module } from '@nestjs/common';
import { OwnershipCostService } from './ownership-cost.service';
import { CarIntelligenceViewService } from './car-intelligence-view.service';

@Module({
  providers: [OwnershipCostService, CarIntelligenceViewService],
  exports: [OwnershipCostService, CarIntelligenceViewService],
})
export class IntelligenceModule {}
