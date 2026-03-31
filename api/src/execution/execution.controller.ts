import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ExecutionEngineService } from './execution-engine.service';
import { PortfolioAutoRebalanceService } from './portfolio-auto-rebalance.service';
import { ExecutionRunService } from './execution-run.service';
import { ExecutionPerformanceService } from './execution-performance.service';

class ApproveBodyDto {
  @IsString()
  userId!: string;

  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

class ExecuteBodyDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsBoolean()
  bypassApproval?: boolean;
}

@Controller('execution')
export class ExecutionController {
  constructor(
    private readonly engine: ExecutionEngineService,
    private readonly autoRebalance: PortfolioAutoRebalanceService,
    private readonly run: ExecutionRunService,
    private readonly perf: ExecutionPerformanceService,
  ) {}

  @Get('plan')
  marketPlan(@Query('persist') persist?: string) {
    return this.engine.buildPlan({ persist: persist === 'true' });
  }

  /** Alias مطابق پرامپت: GET /execution/plan/:userId */
  @Get('plan/:userId')
  planForUser(
    @Param('userId') userId: string,
    @Query('persist') persist?: string,
  ) {
    return this.engine.buildPlan({
      userId,
      persist: persist === 'true',
    });
  }

  @Get('plan/user/:userId')
  userPlan(
    @Param('userId') userId: string,
    @Query('persist') persist?: string,
  ) {
    return this.engine.buildPlan({
      userId,
      persist: persist === 'true',
    });
  }

  @Get('plans')
  listPlans(
    @Query('userId') userId?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = Math.min(Math.max(Number(limitRaw) || 40, 1), 200);
    return this.engine.listPlans({ userId, limit });
  }

  @Get('plans/:id')
  planDetail(@Param('id') id: string) {
    return this.engine.getPlanById(id);
  }

  @Get('rebalance/:userId')
  rebalanceUser(@Param('userId') userId: string) {
    return this.autoRebalance.rebalanceForUser(userId);
  }

  @Get('actions')
  actionCatalog() {
    return this.engine.actionCatalog();
  }

  @Get('history')
  history(
    @Query('userId') userId?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = Math.min(Math.max(Number(limitRaw) || 40, 1), 200);
    return this.engine.listHistory({ userId, limit });
  }

  @Get('history/:userId')
  historyByUser(@Param('userId') userId: string) {
    return Promise.all([
      this.engine.listPlans({ userId, limit: 40 }),
      this.engine.listResults({ userId, limit: 120 }),
    ]).then(([plans, results]) => ({ plans, results }));
  }

  @Get('results')
  results(
    @Query('userId') userId?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = Math.min(Math.max(Number(limitRaw) || 50, 1), 500);
    return this.engine.listResults({ userId, limit });
  }

  @Get('results/user/:userId')
  resultsByUser(
    @Param('userId') userId: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = Math.min(Math.max(Number(limitRaw) || 80, 1), 500);
    return this.engine.listResults({ userId, limit });
  }

  @Post('simulate/:planId')
  simulate(@Param('planId') planId: string) {
    return this.run.simulatePlan(planId);
  }

  @Post('approve/:planId')
  approve(@Param('planId') planId: string, @Body() body: ApproveBodyDto) {
    return this.run.approvePlan(
      planId,
      body.userId,
      body.approved,
      body.note,
    );
  }

  @Post('execute/:planId')
  execute(@Param('planId') planId: string, @Body() body: ExecuteBodyDto) {
    return this.run.executePlan(planId, {
      userId: body.userId,
      bypassApproval: body.bypassApproval === true,
    });
  }

  @Get('performance')
  performance() {
    return this.perf.summary();
  }

  @Get('performance/actions')
  performanceByAction() {
    return this.perf.byActionType();
  }

  @Get('performance/strategies')
  performanceByStrategy() {
    return this.perf.byStrategy();
  }

  @Get('performance/market-cycle')
  performanceByMarketCycle() {
    return this.perf.byMarketCycle();
  }

  @Get('performance/calibration')
  performanceCalibration() {
    return this.perf.confidenceCalibration();
  }

  @Get('decision-impact')
  decisionImpact() {
    return this.perf.decisionImpact();
  }
}
