import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UserBehaviorService } from './user-behavior.service';
import { UserBehaviorController } from './user-behavior.controller';

@Module({
  imports: [PrismaModule],
  controllers: [UserBehaviorController],
  providers: [UserBehaviorService],
  exports: [UserBehaviorService],
})
export class UserBehaviorModule {}
