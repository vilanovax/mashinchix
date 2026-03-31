import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { LearningEngineService } from './learning-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdaptiveWeightService, SCOPE_SCORING_BLEND } from './adaptive-weight.service';
import { ModelSelectionService } from './model-selection.service';

class RecomputeLearningDto {
  @IsOptional()
  @IsBoolean()
  skipOutcomes?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(5000)
  maxRecommendationRows?: number;
}

@Controller('learning')
export class LearningController {
  constructor(
    private readonly engine: LearningEngineService,
    private readonly prisma: PrismaService,
    private readonly adaptive: AdaptiveWeightService,
    private readonly selection: ModelSelectionService,
  ) {}

  @Get('models')
  async models() {
    const [summary, selections, latest] = await Promise.all([
      this.engine.summary(),
      this.selection.getSelections(),
      this.prisma.modelPerformanceHistory.findMany({
        orderBy: { createdAt: 'desc' },
        take: 48,
      }),
    ]);
    return { summary, selections, latestPerformanceRows: latest };
  }

  @Get('signals')
  signals(@Query('limit') limit?: string) {
    const take = Math.min(parseInt(limit ?? '40', 10) || 40, 200);
    return this.prisma.signalPerformance.findMany({
      orderBy: { periodEnd: 'desc' },
      take,
    });
  }

  @Get('recommendations')
  recommendations(@Query('limit') limit?: string) {
    const take = Math.min(parseInt(limit ?? '40', 10) || 40, 300);
    return this.prisma.recommendationOutcome.findMany({
      orderBy: { evaluatedAt: 'desc' },
      take,
    });
  }

  @Get('strategies')
  strategies(@Query('limit') limit?: string) {
    const take = Math.min(parseInt(limit ?? '30', 10) || 30, 120);
    return this.prisma.strategyOutcome.findMany({
      orderBy: { periodEnd: 'desc' },
      take,
    });
  }

  @Get('portfolio')
  portfolio(@Query('limit') limit?: string) {
    const take = Math.min(parseInt(limit ?? '40', 10) || 40, 200);
    return this.prisma.portfolioOutcome.findMany({
      orderBy: { evaluatedAt: 'desc' },
      take,
    });
  }

  @Get('weights')
  async weights() {
    const rows = await this.prisma.adaptiveWeights.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    const scoring = await this.adaptive.getWeights(SCOPE_SCORING_BLEND);
    return { adaptiveRows: rows, scoringBlendEffective: scoring };
  }

  @Post('recompute')
  async recompute(@Body() body?: RecomputeLearningDto) {
    return this.engine.recompute({
      skipOutcomes: body?.skipOutcomes,
      maxRecommendationRows: body?.maxRecommendationRows,
    });
  }
}
