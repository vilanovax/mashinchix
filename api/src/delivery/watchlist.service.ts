import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWatchlistDto, toDecimalOrNull } from './dto/create-watchlist.dto';
import { UpdateWatchlistDto, nullableDecimal } from './dto/update-watchlist.dto';

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWatchlistDto) {
    const [user, car] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.userId } }),
      this.prisma.car.findUnique({ where: { id: dto.carId } }),
    ]);
    if (!user) throw new NotFoundException('کاربر یافت نشد');
    if (!car) throw new NotFoundException('خودرو یافت نشد');

    try {
      return await this.prisma.userWatchlist.create({
        data: {
          userId: dto.userId,
          carId: dto.carId,
          notes: dto.notes,
          targetBuyPrice: toDecimalOrNull(dto.targetBuyPrice),
          targetSellPrice: toDecimalOrNull(dto.targetSellPrice),
          alertOnPriceDrop: dto.alertOnPriceDrop ?? true,
          alertOnPriceRise: dto.alertOnPriceRise ?? false,
          alertOnBuySignal: dto.alertOnBuySignal ?? true,
          alertOnSellSignal: dto.alertOnSellSignal ?? true,
          alertOnHighRisk: dto.alertOnHighRisk ?? true,
          alertOnMomentum: dto.alertOnMomentum ?? false,
        },
        include: {
          car: {
            select: {
              id: true,
              brand: true,
              model: true,
              year: true,
              segment: true,
            },
          },
        },
      });
    } catch (e: unknown) {
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        (e as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException('این خودرو قبلاً در لیست رصد است');
      }
      throw e;
    }
  }

  listForUser(userId: string) {
    return this.prisma.userWatchlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        car: {
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            segment: true,
            image: true,
            marketData: {
              select: {
                avgPrice: true,
                marketSignal: true,
                priceChange30d: true,
                momentumScore: true,
              },
            },
            scores: {
              select: { riskScore: true, overallScore: true },
            },
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateWatchlistDto) {
    const row = await this.prisma.userWatchlist.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('رکورد لیست رصد یافت نشد');

    const data: Prisma.UserWatchlistUpdateInput = {};
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.targetBuyPrice !== undefined) {
      data.targetBuyPrice =
        dto.targetBuyPrice === null
          ? null
          : new Prisma.Decimal(dto.targetBuyPrice);
    }
    if (dto.targetSellPrice !== undefined) {
      data.targetSellPrice =
        dto.targetSellPrice === null
          ? null
          : new Prisma.Decimal(dto.targetSellPrice);
    }
    if (dto.alertOnPriceDrop !== undefined) {
      data.alertOnPriceDrop = dto.alertOnPriceDrop;
    }
    if (dto.alertOnPriceRise !== undefined) {
      data.alertOnPriceRise = dto.alertOnPriceRise;
    }
    if (dto.alertOnBuySignal !== undefined) {
      data.alertOnBuySignal = dto.alertOnBuySignal;
    }
    if (dto.alertOnSellSignal !== undefined) {
      data.alertOnSellSignal = dto.alertOnSellSignal;
    }
    if (dto.alertOnHighRisk !== undefined) {
      data.alertOnHighRisk = dto.alertOnHighRisk;
    }
    if (dto.alertOnMomentum !== undefined) {
      data.alertOnMomentum = dto.alertOnMomentum;
    }

    return this.prisma.userWatchlist.update({
      where: { id },
      data,
      include: {
        car: {
          select: { id: true, brand: true, model: true, year: true, segment: true },
        },
      },
    });
  }

  async remove(id: string) {
    try {
      await this.prisma.userWatchlist.delete({ where: { id } });
    } catch {
      throw new NotFoundException('رکورد لیست رصد یافت نشد');
    }
  }
}
