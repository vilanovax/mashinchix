import { Controller, Get, Query } from '@nestjs/common';
import { AdaptiveAnalyticsService } from './adaptive-analytics.service';

@Controller('analytics/adaptive')
export class AdaptiveAnalyticsController {
  constructor(private readonly analytics: AdaptiveAnalyticsService) {}

  @Get('weights')
  weights() {
    return this.analytics.activeWeights();
  }

  @Get('versions')
  versions(
    @Query('scope') scope?: string,
    @Query('take') takeRaw?: string,
  ) {
    const take = Math.min(Math.max(Number(takeRaw) || 80, 1), 500);
    return this.analytics.versions(scope, take);
  }

  @Get('events')
  events(
    @Query('scope') scope?: string,
    @Query('take') takeRaw?: string,
  ) {
    const take = Math.min(Math.max(Number(takeRaw) || 200, 1), 1_000);
    return this.analytics.events(scope, take);
  }

  @Get('experiments')
  experiments() {
    return this.analytics.experiments();
  }

  @Get('performance')
  performance() {
    return this.analytics.performanceSummary();
  }

  @Get('drift')
  drift(
    @Query('scope') scope?: string,
    @Query('take') takeRaw?: string,
  ) {
    const take = Math.min(Math.max(Number(takeRaw) || 120, 1), 2_000);
    return this.analytics.drift(scope, take);
  }
}
