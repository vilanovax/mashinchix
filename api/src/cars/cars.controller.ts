import { Controller, Get, Param, Query } from '@nestjs/common';
import { CarIntelligenceViewService } from '../intelligence/car-intelligence-view.service';
import { CarRankingsService } from '../scoring/car-rankings.service';
import { CarScoreCalculationService } from '../scoring/car-score-calculation.service';
import { BuySellSignalService } from '../data-platform/buy-sell-signal.service';
import { CarsService } from './cars.service';
import { QueryCarsDto } from './dto/query-cars.dto';
import { QueryRankingsDto } from './dto/query-rankings.dto';

@Controller('cars')
export class CarsController {
  constructor(
    private readonly cars: CarsService,
    private readonly scoreEngine: CarScoreCalculationService,
    private readonly rankingsService: CarRankingsService,
    private readonly intelligenceView: CarIntelligenceViewService,
    private readonly buySellSignals: BuySellSignalService,
  ) {}

  @Get()
  list(@Query() query: QueryCarsDto) {
    return this.cars.findAll(query);
  }

  @Get('rankings/category/:category')
  listCategoryRankings(
    @Param('category') category: string,
    @Query('limit') limit?: string,
    @Query('segment') segment?: string,
  ) {
    const n = limit != null ? parseInt(limit, 10) : 50;
    return this.rankingsService.getCategoryRankings(
      category,
      Number.isFinite(n) ? n : 50,
      segment,
    );
  }

  @Get('rankings')
  listRankings(@Query() query: QueryRankingsDto) {
    return this.rankingsService.getRankings(query);
  }

  @Get(':id/price-history')
  priceHistory(@Param('id') id: string) {
    return this.cars.getPriceHistory(id);
  }

  @Get(':id/market-signal')
  marketSignal(@Param('id') id: string) {
    return this.buySellSignals.getMarketSignalForCar(id);
  }

  @Get(':id/intelligence')
  async intelligence(@Param('id') id: string) {
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

  @Get(':id')
  get(@Param('id') id: string) {
    return this.cars.findOne(id);
  }
}
