import { Module } from '@nestjs/common';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { LearningModule } from '../learning/learning.module';
import { CarScoreCalculationService } from './car-score-calculation.service';
import { CarRankingsService } from './car-rankings.service';

@Module({
  imports: [IntelligenceModule, LearningModule],
  providers: [CarScoreCalculationService, CarRankingsService],
  exports: [CarScoreCalculationService, CarRankingsService],
})
export class ScoringModule {}
