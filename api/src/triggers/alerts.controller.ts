import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TriggerEngineService } from './trigger-engine.service';
import { UserNotificationService } from '../delivery/user-notification.service';

/** بستهٔ هشدار/نوتیف برای کاربر احرازشده — معادل پرامپت GET /alerts */
@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly engine: TriggerEngineService,
    private readonly userNotifications: UserNotificationService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async userPack(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: string,
  ) {
    const l = limit != null ? parseInt(limit, 10) : 40;
    const take = Number.isFinite(l) ? l : 40;
    const [triggerEvents, notifications] = await Promise.all([
      this.engine.userEvents(userId, take),
      this.userNotifications.listPrioritizedForUser(userId, take + 10),
    ]);
    return { userId, triggerEvents, notifications };
  }

  @Patch('notifications/:id/read')
  @UseGuards(JwtAuthGuard)
  markNotificationRead(
    @CurrentUser('sub') userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.userNotifications.markAsRead(userId, notificationId);
  }
}
