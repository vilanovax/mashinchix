import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ModelEvaluationModule } from '../model-evaluation/model-evaluation.module';
import { AdaptiveGuardrailService } from './adaptive-guardrail.service';
import { AdaptiveVersioningService } from './adaptive-versioning.service';
import { AdaptiveRuntimeConfigService } from './adaptive-runtime-config.service';
import { AdaptivePerformanceGateService } from './adaptive-performance-gate.service';
import { AdaptiveAnalyticsService } from './adaptive-analytics.service';
import { AdaptiveAdminController } from './adaptive-admin.controller';
import { AdaptiveAnalyticsController } from './adaptive-analytics.controller';

@Module({
  imports: [PrismaModule, ModelEvaluationModule],
  controllers: [AdaptiveAdminController, AdaptiveAnalyticsController],
  providers: [
    AdaptiveGuardrailService,
    AdaptiveVersioningService,
    AdaptiveRuntimeConfigService,
    AdaptivePerformanceGateService,
    AdaptiveAnalyticsService,
  ],
  exports: [
    AdaptiveGuardrailService,
    AdaptiveVersioningService,
    AdaptiveRuntimeConfigService,
    AdaptivePerformanceGateService,
    AdaptiveAnalyticsService,
  ],
})
export class AdaptiveModule {}
