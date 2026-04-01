import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { UpsertUserProfileDto } from './dto/upsert-user-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('user-profiles')
export class UserProfileController {
  constructor(private readonly profiles: UserProfileService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser('sub') userId: string) {
    return this.profiles.findByUserId(userId);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  upsertMe(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpsertUserProfileDto,
  ) {
    return this.profiles.upsertForUser(userId, dto);
  }

  @Get(':userId')
  get(@Param('userId') userId: string) {
    return this.profiles.findByUserId(userId);
  }

  @Put(':userId')
  upsert(
    @Param('userId') userId: string,
    @Body() dto: UpsertUserProfileDto,
  ) {
    return this.profiles.upsertForUser(userId, dto);
  }
}
