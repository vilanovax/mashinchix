import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UserActionPlanService } from './user-action-plan.service';
import { AdvisorHistoryService } from './advisor-history.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('advisor')
export class AdvisorController {
  constructor(
    private readonly plan: UserActionPlanService,
    private readonly advisorHistory: AdvisorHistoryService,
  ) {}

  @Get('today')
  @UseGuards(JwtAuthGuard)
  todayMe(
    @CurrentUser('sub') userId: string,
    @Query('persist') persist?: string,
  ) {
    const p = persist === 'true' || persist === '1';
    return this.plan.getTodayActionPlan(userId.trim(), p);
  }

  @Get('actions')
  @UseGuards(JwtAuthGuard)
  async actionsMe(@CurrentUser('sub') userId: string) {
    const full = await this.plan.getTodayActionPlan(userId.trim(), false);
    return {
      date: full.date,
      recommendedActions: full.recommendedActions,
      confidence: full.confidence,
    };
  }

  @Get('impact')
  @UseGuards(JwtAuthGuard)
  async impactMe(@CurrentUser('sub') userId: string) {
    const full = await this.plan.getTodayActionPlan(userId.trim(), false);
    return {
      date: full.date,
      expectedImpact: full.expectedImpact,
      sources: full.sources,
    };
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  async summaryMe(@CurrentUser('sub') userId: string) {
    const full = await this.plan.getTodayActionPlan(userId.trim(), false);
    return {
      date: full.date,
      marketState: full.marketState,
      portfolioState: full.portfolioState,
      riskState: full.riskState,
      confidence: full.confidence,
      summary: full.summary,
      briefing: full.briefing,
      summaryEnglish: full.summaryEnglish,
    };
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  snapshotHistoryMe(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: string,
  ) {
    const l = limit != null ? parseInt(limit, 10) : 30;
    return this.advisorHistory.listForUser(
      userId.trim(),
      Number.isFinite(l) ? l : 30,
    );
  }

  /** Today Action — خروجی کامل لایهٔ محصول */
  @Get('today/:userId')
  today(
    @Param('userId') userId: string,
    @Query('persist') persist?: string,
  ) {
    const p = persist === 'true' || persist === '1';
    return this.plan.getTodayActionPlan(userId.trim(), p);
  }

  @Get('actions/:userId')
  async actions(@Param('userId') userId: string) {
    const full = await this.plan.getTodayActionPlan(userId.trim(), false);
    return {
      date: full.date,
      recommendedActions: full.recommendedActions,
      confidence: full.confidence,
    };
  }

  @Get('impact/:userId')
  async impact(@Param('userId') userId: string) {
    const full = await this.plan.getTodayActionPlan(userId.trim(), false);
    return {
      date: full.date,
      expectedImpact: full.expectedImpact,
      sources: full.sources,
    };
  }

  @Get('summary/:userId')
  async summary(@Param('userId') userId: string) {
    const full = await this.plan.getTodayActionPlan(userId.trim(), false);
    return {
      date: full.date,
      marketState: full.marketState,
      portfolioState: full.portfolioState,
      riskState: full.riskState,
      confidence: full.confidence,
      summary: full.summary,
      briefing: full.briefing,
      summaryEnglish: full.summaryEnglish,
    };
  }

  @Get('history/:userId')
  snapshotHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const l = limit != null ? parseInt(limit, 10) : 30;
    return this.advisorHistory.listForUser(
      userId.trim(),
      Number.isFinite(l) ? l : 30,
    );
  }
}
