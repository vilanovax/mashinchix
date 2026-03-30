import { Body, Controller, Param, Patch } from '@nestjs/common';
import { ScoresService } from '../scores/scores.service';
import { MarketService } from '../market/market.service';
import { UpdateScoresDto } from '../scores/dto/update-scores.dto';
import { UpdateMarketDto } from '../market/dto/update-market.dto';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly scores: ScoresService,
    private readonly market: MarketService,
  ) {}

  @Patch('cars/:id/scores')
  patchScores(@Param('id') id: string, @Body() dto: UpdateScoresDto) {
    return this.scores.updateForCar(id, dto);
  }

  @Patch('cars/:id/market')
  patchMarket(@Param('id') id: string, @Body() dto: UpdateMarketDto) {
    return this.market.updateForCar(id, dto);
  }
}
