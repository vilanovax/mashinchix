import {
  Controller,
  Get,
  MessageEvent,
  Param,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Observable, from, interval } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';
import { TriggerEngineService } from './trigger-engine.service';
import { UserNotificationService } from '../delivery/user-notification.service';

@Controller('triggers')
export class TriggersController {
  constructor(
    private readonly engine: TriggerEngineService,
    private readonly userNotifications: UserNotificationService,
  ) {}

  @Get()
  list(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 50;
    return this.engine.recentEvents(Number.isFinite(l) ? l : 50);
  }

  @Get('market')
  market(@Query('limit') limit?: string) {
    const l = limit != null ? parseInt(limit, 10) : 50;
    return this.engine.marketEvents(Number.isFinite(l) ? l : 50);
  }

  @Get('user/me')
  @UseGuards(JwtAuthGuard)
  async forCurrentUser(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: string,
  ) {
    const l = limit != null ? parseInt(limit, 10) : 30;
    const take = Number.isFinite(l) ? l : 30;
    const [triggerEvents, notifications] = await Promise.all([
      this.engine.userEvents(userId, take),
      this.userNotifications.listPrioritizedForUser(userId, take + 10),
    ]);
    return {
      userId,
      triggerEvents,
      notifications,
    };
  }

  @Get('user/:userId')
  async forUser(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const l = limit != null ? parseInt(limit, 10) : 30;
    const take = Number.isFinite(l) ? l : 30;
    const [triggerEvents, notifications] = await Promise.all([
      this.engine.userEvents(userId, take),
      this.userNotifications.listPrioritizedForUser(userId, take + 10),
    ]);
    return {
      userId,
      triggerEvents,
      notifications,
    };
  }

  @Get('portfolio/:userId')
  portfolio(@Param('userId') userId: string) {
    return this.engine.portfolioContext(userId);
  }

  /** به‌روزرسانی polling‌ناپذیر؛ هر ~۲۵ ثانیه آخرین رویدادها */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return interval(25_000).pipe(
      startWith(0),
      switchMap(() => from(this.engine.recentEvents(35))),
      map((events) => ({
        data: JSON.stringify({
          events,
          generatedAt: new Date().toISOString(),
        }),
      })),
    );
  }
}
