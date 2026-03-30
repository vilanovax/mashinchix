import { Controller, Get, Param, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DecisionEngineService } from './decision-engine.service';

@Controller('decision')
export class DecisionController {
  constructor(
    private readonly engine: DecisionEngineService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('summary')
  summary(@Query('userId') userId?: string) {
    return this.engine.generateDecisionSummary(
      userId?.trim() || undefined,
      { persist: true },
    );
  }

  @Get('market')
  market() {
    return this.engine.generateDecisionSummary(undefined, { persist: true });
  }

  @Get('portfolio/:userId')
  portfolio(@Param('userId') userId: string) {
    return this.engine.generateDecisionSummary(userId, { persist: true });
  }

  @Get('strategy')
  strategy(@Query('userId') userId?: string) {
    return this.engine.getStrategySlice(userId?.trim() || undefined);
  }

  @Get('history')
  history(
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
  ) {
    const l = limit != null ? parseInt(limit, 10) : 40;
    const take = Math.min(Math.max(Number.isFinite(l) ? l : 40, 1), 100);
    return this.prisma.decisionSnapshot.findMany({
      where: userId?.trim() ?
          { userId: userId.trim() }
        : { userId: null },
      orderBy: { snapshotDate: 'desc' },
      take,
    });
  }

  @Get('opportunities')
  async opportunities() {
    const row = await this.prisma.decisionSnapshot.findFirst({
      where: { userId: null },
      orderBy: { createdAt: 'desc' },
      select: {
        opportunities: true,
        snapshotDate: true,
        confidence: true,
      },
    });
    if (!row) {
      const fresh = await this.engine.generateDecisionSummary(undefined, {
        persist: true,
      });
      return {
        snapshotDate: fresh.snapshotDate,
        confidence: fresh.confidenceScore,
        items: fresh.opportunities,
      };
    }
    return {
      snapshotDate: row.snapshotDate,
      confidence: row.confidence,
      items: row.opportunities,
    };
  }

  @Get('warnings')
  async warnings() {
    const row = await this.prisma.decisionSnapshot.findFirst({
      where: { userId: null },
      orderBy: { createdAt: 'desc' },
      select: {
        warnings: true,
        snapshotDate: true,
        riskLevel: true,
      },
    });
    if (!row) {
      const fresh = await this.engine.generateDecisionSummary(undefined, {
        persist: true,
      });
      return {
        snapshotDate: fresh.snapshotDate,
        riskLevel: fresh.riskLevel,
        items: fresh.warnings,
      };
    }
    return {
      snapshotDate: row.snapshotDate,
      riskLevel: row.riskLevel,
      items: row.warnings,
    };
  }
}
