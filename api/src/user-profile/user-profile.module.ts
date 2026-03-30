import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UserProfileController } from './user-profile.controller';
import { UserProfileService } from './user-profile.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserProfileController],
  providers: [UserProfileService],
  exports: [UserProfileService],
})
export class UserProfileModule {}
