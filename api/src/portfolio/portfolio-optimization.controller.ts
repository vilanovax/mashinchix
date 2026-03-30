import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PortfolioOptimizeDto } from './dto/portfolio-optimize.dto';
import { PortfolioOptQueryDto } from './dto/portfolio-opt-query.dto';
import { PortfolioRebalanceDto } from './dto/portfolio-rebalance.dto';
import { PortfolioOptimizationService } from './portfolio-optimization.service';
import { PortfolioRebalancingService } from './portfolio-rebalancing.service';

@Controller('portfolio')
export class PortfolioOptimizationController {
  constructor(
    private readonly optimization: PortfolioOptimizationService,
    private readonly rebalancing: PortfolioRebalancingService,
  ) {}

  @Post('optimize')
  optimize(@Body() dto: PortfolioOptimizeDto) {
    return this.optimization.optimize({
      carIds: dto.carIds,
      budget: dto.budget,
      methodology: dto.methodology,
      maxWeightPerCar: dto.maxWeightPerCar,
      maxWeightPerSegment: dto.maxWeightPerSegment,
      minLiquidity: dto.minLiquidity,
      maxPortfolioVolatility: dto.maxPortfolioVolatility,
      riskTolerance: dto.riskTolerance,
      mcSamples: dto.mcSamples,
      useHistoricalMaxDrawdown: dto.useHistoricalMaxDrawdown === true,
      persist: dto.persist === true,
    });
  }

  @Post('rebalance')
  rebalance(@Body() dto: PortfolioRebalanceDto) {
    return this.rebalancing.analyze({
      currentHoldings: dto.currentHoldings,
      budget: dto.budget,
      methodology: dto.methodology,
      carIds: dto.carIds,
      maxWeightPerCar: dto.maxWeightPerCar,
      maxWeightPerSegment: dto.maxWeightPerSegment,
      minLiquidity: dto.minLiquidity,
      maxPortfolioVolatility: dto.maxPortfolioVolatility,
      riskTolerance: dto.riskTolerance,
      mcSamples: dto.mcSamples,
    });
  }

  @Get('optimization/frontier')
  frontier(@Query() q: PortfolioOptQueryDto) {
    const p = q.toUniverseParams();
    return this.optimization.frontier({
      ...p,
      steps: q.steps,
    });
  }

  @Get('optimization/best')
  best(@Query() q: PortfolioOptQueryDto) {
    const p = q.toUniverseParams();
    return this.optimization.bestBySharpe(p);
  }

  @Get('optimization/risk-parity')
  riskParity(@Query() q: PortfolioOptQueryDto) {
    const p = q.toUniverseParams();
    return this.optimization.optimize({
      ...p,
      methodology: 'RISK_PARITY',
      persist: false,
    });
  }

  @Get('optimization/max-sharpe')
  maxSharpe(@Query() q: PortfolioOptQueryDto) {
    const p = q.toUniverseParams();
    return this.optimization.optimize({
      ...p,
      methodology: 'MAX_SHARPE',
      persist: false,
    });
  }

  @Get('optimization/min-volatility')
  minVolatility(@Query() q: PortfolioOptQueryDto) {
    const p = q.toUniverseParams();
    return this.optimization.optimize({
      ...p,
      methodology: 'MIN_VOLATILITY',
      persist: false,
    });
  }

  @Get('optimization/history')
  history(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 20;
    return this.optimization.latestResults(Number.isFinite(l) ? l : 20);
  }
}
