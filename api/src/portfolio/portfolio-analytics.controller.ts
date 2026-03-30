import { Controller, Get, Query } from '@nestjs/common';
import { PortfolioAnalyticsService } from './portfolio-analytics.service';

@Controller('analytics/portfolio')
export class PortfolioAnalyticsController {
  constructor(private readonly analytics: PortfolioAnalyticsService) {}

  @Get('best-allocation')
  bestAllocation() {
    return this.analytics.bestAllocationSample();
  }

  @Get('risk-return')
  riskReturn(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 120;
    return this.analytics.riskReturnScatter(Number.isFinite(l) ? l : 120);
  }

  @Get('efficient-frontier')
  efficientFrontier(
    @Query('persist') persist?: string,
    @Query('samples') samples?: string,
  ) {
    const sParsed = samples != null ? parseInt(samples, 10) : NaN;
    return this.analytics.efficientFrontier({
      persist: persist === 'true' || persist === '1',
      samples: Number.isFinite(sParsed) ? sParsed : undefined,
    });
  }

  @Get('diversification')
  diversification() {
    return this.analytics.diversificationOverview();
  }

  @Get('segment-allocation')
  segmentAllocation() {
    return this.analytics.segmentAllocationRecommended();
  }
}
