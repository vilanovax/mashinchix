import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IntelligenceDeliveryModule } from '../delivery/intelligence-delivery.module';
import { LearningModule } from '../learning/learning.module';
import { TriggerEngineService } from './trigger-engine.service';
import { TriggersController } from './triggers.controller';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [PrismaModule, IntelligenceDeliveryModule, LearningModule],
  controllers: [TriggersController, AlertsController],
  providers: [TriggerEngineService],
  exports: [TriggerEngineService],
})
export class TriggersModule {}
