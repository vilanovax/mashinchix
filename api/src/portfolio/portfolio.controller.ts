import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { PortfolioRecommendationService } from './portfolio-recommendation.service';
import { StrategyAdvisorService } from './strategy-advisor.service';
import { RecommendPortfolioDto } from './dto/portfolio-recommend.dto';
import { PortfolioSimulateDto } from './dto/portfolio-simulate.dto';
import { simulateBuyAndHoldWeighted } from './custom-portfolio-sim.util';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioPerformanceService } from './portfolio-performance.service';
import { PortfolioLedgerService } from './portfolio-ledger.service';

@Controller('portfolio')
export class PortfolioController {
  constructor(
    private readonly recommendation: PortfolioRecommendationService,
    private readonly strategyAdvisor: StrategyAdvisorService,
    private readonly prisma: PrismaService,
    private readonly performance: PortfolioPerformanceService,
    private readonly ledger: PortfolioLedgerService,
  ) {}

  @Post('recommend')
  async recommend(@Body() dto: RecommendPortfolioDto) {
    return this.recommendation.recommendPortfolio({
      budget: dto.budget,
      riskTolerance: dto.riskTolerance,
      investmentHorizonMonths: dto.investmentHorizonMonths,
      preferredSegments: dto.preferredSegments,
      maxCars: dto.maxCars ?? 5,
      strategyPreference: dto.strategyPreference,
      userId: dto.userId,
      persist: dto.persist === true,
    });
  }

  @Post('simulate')
  async simulate(@Body() dto: PortfolioSimulateDto) {
    if (dto.endDate <= dto.startDate) {
      throw new BadRequestException('بازه تاریخ نامعتبر است');
    }
    const n = dto.carIds.length;
    let weights =
      dto.weights ??
      dto.carIds.map(() => 1 / n);
    if (weights.length !== n) {
      throw new BadRequestException('طول weights با carIds برابر نیست');
    }
    const s = weights.reduce((a, b) => a + b, 0);
    if (Math.abs(s - 1) > 1e-3) {
      weights = weights.map((w) => w / s);
    }
    const res = await simulateBuyAndHoldWeighted(
      this.prisma,
      dto.carIds,
      weights,
      dto.startDate,
      dto.endDate,
    );
    if (!res) {
      throw new BadRequestException(
        'شبیه‌سازی ممکن نشد — دادهٔ قیمت مشترک کافی نیست',
      );
    }
    return {
      carIds: dto.carIds,
      weights,
      ...res,
    };
  }

  @Get('strategies')
  strategiesCatalog() {
    return this.strategyAdvisor.listStrategiesCatalog();
  }

  @Get('strategies/best')
  bestStrategies(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 8;
    return this.strategyAdvisor.bestFromHistory(Number.isFinite(l) ? l : 8);
  }

  @Get('market-strategy')
  marketStrategy(@Query('userId') userId?: string) {
    return this.strategyAdvisor.recommendStrategy({ userId });
  }

  @Get('allocation/:userId')
  async userAllocation(@Param('userId') userId: string) {
    const row = await this.prisma.userPortfolioRecommendation.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) {
      throw new NotFoundException('توصیهٔ ذخیره‌شده‌ای برای این کاربر نیست');
    }
    return row;
  }

  @Get('performance/:userId')
  portfolioPerformance(@Param('userId') userId: string) {
    return this.performance.getPerformance(userId);
  }

  @Get('history/:userId')
  portfolioHistory(
    @Param('userId') userId: string,
    @Query('take') take?: string,
  ) {
    const t = take != null ? parseInt(take, 10) : 60;
    return this.performance.getHistory(
      userId,
      Number.isFinite(t) ? t : 60,
    );
  }

  @Get('positions/:userId')
  portfolioPositions(@Param('userId') userId: string) {
    return this.performance.getPositions(userId);
  }

  @Get('transactions/:userId')
  portfolioTransactions(
    @Param('userId') userId: string,
    @Query('take') take?: string,
  ) {
    const t = take != null ? parseInt(take, 10) : 80;
    return this.performance.getTransactions(
      userId,
      Number.isFinite(t) ? t : 80,
    );
  }

  @Get('value/:userId')
  portfolioValue(@Param('userId') userId: string) {
    return this.performance.getValue(userId);
  }

  @Get('state/:userId')
  portfolioState(@Param('userId') userId: string) {
    return this.ledger.getPortfolioState(userId);
  }
}
