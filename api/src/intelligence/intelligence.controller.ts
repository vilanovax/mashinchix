import { Controller, Get, Param, Query } from '@nestjs/common';
import { IntelligenceOverviewService } from './intelligence-overview.service';

@Controller('intelligence')
export class IntelligenceController {
  constructor(private readonly overview: IntelligenceOverviewService) {}

  @Get('overview')
  unified(
    @Query('userId') userId?: string,
    @Query('persist') persist?: string,
  ) {
    const p = persist === 'true' || persist === '1';
    return this.overview.getUnifiedOverview(userId?.trim() || undefined, {
      persist: p,
    });
  }

  @Get('market')
  market() {
    return this.overview.getMarketOverview();
  }

  @Get('user/:userId')
  user(@Param('userId') userId: string) {
    return this.overview.getUserOverview(userId);
  }

  @Get('portfolio/:userId')
  portfolio(@Param('userId') userId: string) {
    return this.overview.getPortfolioOverview(userId);
  }

  @Get('strategy')
  strategy(@Query('userId') userId?: string) {
    return this.overview.getStrategyOverview(userId?.trim() || undefined);
  }

  @Get('risk')
  risk(@Query('userId') userId?: string) {
    return this.overview.getRiskOverview(userId?.trim() || undefined);
  }

  @Get('opportunities')
  opportunities(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 28;
    return this.overview.getOpportunitiesOverview(
      Number.isFinite(l) ? l : 28,
    );
  }

  @Get('alerts')
  alerts(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 48;
    return this.overview.getAlertsOverview(Number.isFinite(l) ? l : 48);
  }

  @Get('decision')
  decision(@Query('userId') userId?: string) {
    return this.overview.getDecisionOverview(userId?.trim() || undefined);
  }

  @Get('history')
  history(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 24;
    return this.overview.snapshotHistory(Number.isFinite(l) ? l : 24);
  }
}
