import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { CarSubstitutionService } from './car-substitution.service';
import { GraphAnalyticsService } from './graph-analytics.service';
import { MarketCorrelationService } from './market-correlation.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('graph')
export class GraphController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly substitution: CarSubstitutionService,
    private readonly analytics: GraphAnalyticsService,
    private readonly correlation: MarketCorrelationService,
  ) {}

  @Get('car/:id')
  async carGraph(@Param('id') id: string) {
    await this.substitution.getCarOrThrow(id);
    const [outbound, inbound] = await Promise.all([
      this.prisma.carRelationship.findMany({
        where: { carId: id, methodology: 'kg-v1' },
        orderBy: { strength: 'desc' },
        take: 80,
        include: {
          relatedCar: {
            select: { id: true, brand: true, model: true, year: true, segment: true },
          },
        },
      }),
      this.prisma.carRelationship.findMany({
        where: { relatedCarId: id, methodology: 'kg-v1' },
        orderBy: { strength: 'desc' },
        take: 40,
        include: {
          car: {
            select: { id: true, brand: true, model: true, year: true, segment: true },
          },
        },
      }),
    ]);
    return { carId: id, outbound, inbound };
  }

  @Get('car/:id/similar')
  similar(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
  ) {
    return this.substitution.findSimilar(id, Math.min(Math.max(limit, 1), 30));
  }

  @Get('car/:id/substitutes')
  substitutes(
    @Param('id') id: string,
    @Query('budget') budgetRaw: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const budget = budgetRaw != null ? parseFloat(budgetRaw) : NaN;
    if (!Number.isFinite(budget) || budget <= 0) {
      throw new BadRequestException('پارامتر budget الزامی است (عدد > 0)');
    }
    return this.substitution.findSubstitutes(
      id,
      budget,
      Math.min(Math.max(limit, 1), 25),
    );
  }

  @Get('car/:id/correlated')
  correlated(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(15), ParseIntPipe) limit: number,
  ) {
    return this.substitution.findCorrelated(id, Math.min(Math.max(limit, 1), 40));
  }

  @Get('segment/:segment')
  segment(@Param('segment') segment: string) {
    return this.analytics.segmentNeighborhood(decodeURIComponent(segment));
  }

  @Get('market/network')
  network() {
    return this.analytics.marketNetworkSummary();
  }

  @Get('market/flows')
  flows(@Query('limit', new DefaultValuePipe(24), ParseIntPipe) limit: number) {
    return this.analytics.marketFlows(Math.min(Math.max(limit, 5), 60));
  }

  /** بازمحاسبهٔ گراف (سنگین) — در production با نقش ادمین/کلید محافظت شود */
  @Post('recompute')
  recompute(
    @Query('historyDays') historyDays?: string,
    @Query('maxCarsPerSegment') maxCars?: string,
  ) {
    const h = historyDays != null ? parseInt(historyDays, 10) : undefined;
    const m = maxCars != null ? parseInt(maxCars, 10) : undefined;
    return this.correlation.recomputeKnowledgeGraph({
      historyDays: Number.isFinite(h!) ? h : undefined,
      maxCarsPerSegment: Number.isFinite(m!) ? m : undefined,
    });
  }
}
