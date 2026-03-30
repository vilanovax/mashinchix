import { Injectable, Logger } from '@nestjs/common';
import { PredictionEvaluationService } from './prediction-evaluation.service';
import { InvestmentRiskEvaluationService } from './investment-risk-evaluation.service';
import { RecommendationPerformanceService } from './recommendation-performance.service';
import { ScoreCalibrationService } from './score-calibration.service';

@Injectable()
export class ModelEvaluationBatchService {
  private readonly logger = new Logger(ModelEvaluationBatchService.name);

  constructor(
    private readonly predictionEval: PredictionEvaluationService,
    private readonly investmentRiskEval: InvestmentRiskEvaluationService,
    private readonly recPerf: RecommendationPerformanceService,
    private readonly calibration: ScoreCalibrationService,
  ) {}

  async runAll(asOf: Date = new Date()) {
    this.logger.log('Model evaluation batch start');
    const prediction = await this.predictionEval.runEvaluation(asOf);
    const scores = await this.investmentRiskEval.runScoreOutcomeEvaluation(asOf);
    const rec = await this.recPerf.runBackfill(asOf);
    const cal = await this.calibration.runCalibration();
    this.logger.log('Model evaluation batch done');
    return { prediction, scores, rec, cal };
  }
}
