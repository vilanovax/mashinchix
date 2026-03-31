import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ModelEvaluationModule } from '../model-evaluation/model-evaluation.module';
import { AdaptiveModule } from '../adaptive/adaptive.module';
import { LearningEngineService } from './learning-engine.service';
import { LearningOutcomeService } from './learning-outcome.service';
import { AdaptiveWeightService } from './adaptive-weight.service';
import { ModelSelectionService } from './model-selection.service';
import { LearningController } from './learning.controller';

@Module({
  imports: [PrismaModule, ModelEvaluationModule, AdaptiveModule],
  controllers: [LearningController],
  providers: [
    LearningOutcomeService,
    AdaptiveWeightService,
    ModelSelectionService,
    LearningEngineService,
  ],
  exports: [
    AdaptiveModule,
    LearningEngineService,
    LearningOutcomeService,
    AdaptiveWeightService,
    ModelSelectionService,
  ],
})
export class LearningModule {}
