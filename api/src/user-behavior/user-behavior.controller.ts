import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Prisma } from '@prisma/client';
import { UserBehaviorService } from './user-behavior.service';
import { RecordUserActionDto } from './dto/record-user-action.dto';
import { DecisionFeedbackDto } from './dto/decision-feedback.dto';

@Controller('user')
export class UserBehaviorController {
  constructor(private readonly behavior: UserBehaviorService) {}

  @Post('action')
  recordAction(@Body() dto: RecordUserActionDto) {
    return this.behavior.recordUserAction({
      userId: dto.userId,
      actionType: dto.actionType,
      planId: dto.planId,
      executionId: dto.executionId,
      assetId: dto.assetId,
      action: dto.action,
      value: dto.value,
      metadata: dto.metadata as Prisma.InputJsonValue | undefined,
    });
  }

  @Post('decision-feedback')
  decisionFeedback(@Body() dto: DecisionFeedbackDto) {
    return this.behavior.recordDecisionFeedback({
      userId: dto.userId,
      decisionId: dto.decisionId,
      feedback: dto.feedback,
      rating: dto.rating,
      note: dto.note,
    });
  }

  @Get('me/behavior-profile')
  @UseGuards(JwtAuthGuard)
  behaviorProfileMe(@CurrentUser('sub') userId: string) {
    return this.behavior.getBehaviorProfile(userId);
  }

  @Get('me/preferences')
  @UseGuards(JwtAuthGuard)
  preferencesMe(@CurrentUser('sub') userId: string) {
    return this.behavior.getPreferencesPayload(userId);
  }

  @Get('me/risk-profile')
  @UseGuards(JwtAuthGuard)
  riskProfileMe(@CurrentUser('sub') userId: string) {
    return this.behavior.getRiskProfilePayload(userId);
  }

  @Get('behavior-profile/:userId')
  behaviorProfile(@Param('userId') userId: string) {
    return this.behavior.getBehaviorProfile(userId);
  }

  @Get('preferences/:userId')
  preferences(@Param('userId') userId: string) {
    return this.behavior.getPreferencesPayload(userId);
  }

  @Get('risk-profile/:userId')
  riskProfile(@Param('userId') userId: string) {
    return this.behavior.getRiskProfilePayload(userId);
  }
}
