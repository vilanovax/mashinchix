import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { ScenarioAnalyticsService } from './scenario-analytics.service';

@Controller('analytics')
export class ScenarioAnalyticsController {
  constructor(private readonly analytics: ScenarioAnalyticsService) {}

  @Get('scenarios')
  listScenarios() {
    return this.analytics.listScenarios();
  }

  @Get('scenarios/results')
  scenarioResults(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 80;
    return this.analytics.recentResults(Number.isFinite(l) ? l : 80);
  }

  @Get('portfolio/stress')
  portfolioStress(@Query('userId') userId?: string) {
    return this.analytics.portfolioStressSummary(userId);
  }

  @Get('portfolio/scenario-comparison')
  async scenarioComparison(
    @Query('carIds') carIdsRaw?: string,
    @Query('weights') weightsRaw?: string,
    @Query('scenarioIds') scenarioIdsRaw?: string,
  ) {
    if (!carIdsRaw?.trim()) {
      throw new BadRequestException('carIds الزامی است (جدا با ویرگول)');
    }
    const carIds = carIdsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    if (carIds.length < 1) {
      throw new BadRequestException('حداقل یک carId');
    }
    let weights: number[];
    if (weightsRaw?.trim()) {
      weights = weightsRaw.split(',').map((s) => parseFloat(s.trim()));
      if (weights.some((w) => !Number.isFinite(w))) {
        throw new BadRequestException('weights نامعتبر');
      }
    } else {
      weights = carIds.map(() => 1 / carIds.length);
    }
    if (weights.length !== carIds.length) {
      throw new BadRequestException('تعداد weights با carIds یکی نیست');
    }
    const scenarioIds = scenarioIdsRaw
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.analytics.scenarioComparison(carIds, weights, scenarioIds);
  }

  @Get('scenarios/strategy-robustness')
  strategyRobustness(@Query('refresh') refresh?: string) {
    if (refresh === 'true' || refresh === '1') {
      return this.analytics.refreshStrategyRobustness();
    }
    return this.analytics.robustnessByStrategy();
  }
}
