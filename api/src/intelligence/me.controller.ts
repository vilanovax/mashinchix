import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IntelligenceOverviewService } from './intelligence-overview.service';

/** مسیرهای «من»؛ userId از JWT */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly overview: IntelligenceOverviewService) {}

  @Get('intelligence')
  unified(
    @CurrentUser('sub') userId: string,
    @Query('persist') persist?: string,
  ) {
    const p = persist === 'true' || persist === '1';
    return this.overview.getUnifiedOverview(userId, { persist: p });
  }

  @Get('decision')
  decision(@CurrentUser('sub') userId: string) {
    return this.overview.getDecisionOverview(userId);
  }

  @Get('strategy')
  strategy(@CurrentUser('sub') userId: string) {
    return this.overview.getStrategyOverview(userId);
  }

  @Get('risk')
  risk(@CurrentUser('sub') userId: string) {
    return this.overview.getRiskOverview(userId);
  }
}
