import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { UpsertUserProfileDto } from './dto/upsert-user-profile.dto';

@Controller('user-profiles')
export class UserProfileController {
  constructor(private readonly profiles: UserProfileService) {}

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
