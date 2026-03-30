import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MarketReportFrequency } from '@prisma/client';
import { MarketIntelligenceAnalyticsService } from '../analytics/market-intelligence-analytics.service';
import { MarketReportService } from '../analytics/market-report.service';
import { MarketAnalyticsService } from '../analytics/market-analytics.service';
import { CarsService } from '../cars/cars.service';
import { QueryRankingsDto } from '../cars/dto/query-rankings.dto';
import { BuySellSignalService } from '../data-platform/buy-sell-signal.service';
import { CarScoreCalculationService } from '../scoring/car-score-calculation.service';
import { CarIntelligenceViewService } from '../intelligence/car-intelligence-view.service';
import { CarRankingsService } from '../scoring/car-rankings.service';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';
import { ApiKeyGuard } from './api-key.guard';

@Controller('public')
@UseGuards(ApiKeyGuard)
export class PublicController {
  constructor(
    private readonly cars: CarsService,
    private readonly scoreEngine: CarScoreCalculationService,
    private readonly intelligenceView: CarIntelligenceViewService,
    private readonly buySell: BuySellSignalService,
    private readonly prisma: PrismaService,
    private readonly intel: MarketIntelligenceAnalyticsService,
    private readonly marketReport: MarketReportService,
    private readonly market: MarketAnalyticsService,
    private readonly rankings: CarRankingsService,
  ) {}

  @Get('cars/:id/intelligence')
  async carIntelligence(@Param('id') id: string) {
    const [snapshot, viewRow] = await Promise.all([
      this.scoreEngine.buildIntelligenceSnapshot(id),
      this.intelligenceView.getRow(id),
    ]);
    return {
      ...snapshot,
      intelligenceView: viewRow
        ? this.intelligenceView.serialize(viewRow)
        : null,
    };
  }

  @Get('cars/:id/market')
  async carMarket(@Param('id') id: string) {
    const car = await this.prisma.car.findUnique({
      where: { id },
      include: { marketData: true },
    });
    if (!car) {
      throw new NotFoundException('خودرو یافت نشد');
    }
    const md = car.marketData;
    return {
      carId: id,
      brand: car.brand,
      model: car.model,
      year: car.year,
      segment: car.segment,
      marketData: md
        ? {
            ...md,
            avgPrice: toNumber(md.avgPrice),
            minPrice: toNumber(md.minPrice),
            maxPrice: toNumber(md.maxPrice),
            priceChange30d: toNumber(md.priceChange30d),
            priceChange7d: toNumber(md.priceChange7d),
            priceChange90d: toNumber(md.priceChange90d),
          }
        : null,
    };
  }

  @Get('cars/:id/prediction')
  carPrediction(@Param('id') id: string) {
    return this.prisma.pricePrediction.findUnique({
      where: { carId: id },
    });
  }

  @Get('cars/:id/signals')
  carSignals(@Param('id') id: string) {
    return this.buySell.getMarketSignalForCar(id);
  }

  @Get('insights')
  publicInsights(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 40;
    return this.intel.latestInsights({
      limit: Number.isFinite(l) ? l : 40,
    });
  }

  @Get('market/report')
  async publicMarketReport() {
    const saved = await this.marketReport.latestReport(
      MarketReportFrequency.DAILY,
    );
    if (saved) return saved;
    return this.intel.marketReport();
  }

  @Get('segments')
  segments() {
    return this.market.latestSegmentIndices();
  }

  @Get('rankings')
  publicRankings(@Query() query: QueryRankingsDto) {
    return this.rankings.getRankings(query);
  }
}
