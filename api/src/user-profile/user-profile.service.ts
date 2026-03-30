import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertUserProfileDto } from './dto/upsert-user-profile.dto';

@Injectable()
export class UserProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string) {
    return this.prisma.userProfile.findUnique({
      where: { userId },
    });
  }

  async upsertForUser(userId: string, dto: UpsertUserProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    type P = Prisma.UserProfileUncheckedUpdateInput;
    const payload: P = {};
    if (dto.scoreWeights != null) {
      payload.scoreWeights = dto.scoreWeights as Prisma.InputJsonValue;
    }
    if (dto.preferredSegments != null) {
      payload.preferredSegments = dto.preferredSegments;
    }
    if (dto.minBudget != null) {
      payload.minBudget = new Prisma.Decimal(dto.minBudget);
    }
    if (dto.maxBudget != null) {
      payload.maxBudget = new Prisma.Decimal(dto.maxBudget);
    }
    if (dto.investmentBias != null) {
      payload.investmentBias = dto.investmentBias;
    }
    if (dto.holdHorizonMonths != null) {
      payload.holdHorizonMonths = dto.holdHorizonMonths;
    }
    if (dto.popularityWeight != null) {
      payload.popularityWeight = dto.popularityWeight;
    }
    if (dto.ownerSatisfactionWeight != null) {
      payload.ownerSatisfactionWeight = dto.ownerSatisfactionWeight;
    }

    return this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...payload,
      } as Prisma.UserProfileUncheckedCreateInput,
      update: payload,
    });
  }
}
