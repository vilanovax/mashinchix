import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PredictionEvaluationService } from './prediction-evaluation.service';
import { InvestmentRiskEvaluationService } from './investment-risk-evaluation.service';
import { RecommendationPerformanceService } from './recommendation-performance.service';
import { ScoreCalibrationService } from './score-calibration.service';
import { ModelAnalyticsService } from './model-analytics.service';
import { ModelEvaluationBatchService } from './model-evaluation-batch.service';

@Module({
  imports: [PrismaModule],
  providers: [
    PredictionEvaluationService,
    InvestmentRiskEvaluationService,
    RecommendationPerformanceService,
    ScoreCalibrationService,
    ModelAnalyticsService,
    ModelEvaluationBatchService,
  ],
  exports: [
    PredictionEvaluationService,
    InvestmentRiskEvaluationService,
    RecommendationPerformanceService,
    ScoreCalibrationService,
    ModelAnalyticsService,
    ModelEvaluationBatchService,
  ],
})
export class ModelEvaluationModule {}
