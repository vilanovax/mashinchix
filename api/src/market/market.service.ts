import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMarketDto } from './dto/update-market.dto';

@Injectable()
export class MarketService {
  constructor(private readonly prisma: PrismaService) {}

  async updateForCar(carId: string, dto: UpdateMarketDto) {
    const car = await this.prisma.car.findUnique({ where: { id: carId } });
    if (!car) {
      throw new NotFoundException(`Car ${carId} not found`);
    }

    const data: Prisma.CarMarketDataUpdateInput = {};
    if (dto.avgPrice !== undefined) {
      data.avgPrice = new Prisma.Decimal(dto.avgPrice);
    }
    if (dto.minPrice !== undefined) {
      data.minPrice = new Prisma.Decimal(dto.minPrice);
    }
    if (dto.maxPrice !== undefined) {
      data.maxPrice = new Prisma.Decimal(dto.maxPrice);
    }
    if (dto.adsCount !== undefined) data.adsCount = dto.adsCount;
    if (dto.priceChange30d !== undefined) {
      data.priceChange30d = new Prisma.Decimal(dto.priceChange30d);
    }
    if (dto.priceChange1y !== undefined) {
      data.priceChange1y = new Prisma.Decimal(dto.priceChange1y);
    }
    if (dto.liquidityScore !== undefined) {
      data.liquidityScore = dto.liquidityScore;
    }
    if (dto.depreciationRate30d !== undefined) {
      data.depreciationRate30d = new Prisma.Decimal(dto.depreciationRate30d);
    }
    if (dto.priceTrendScore !== undefined) {
      data.priceTrendScore = dto.priceTrendScore;
    }
    if (dto.priceTrendLabel !== undefined) {
      data.priceTrendLabel = dto.priceTrendLabel;
    }
    if (dto.demandScore !== undefined) {
      data.demandScore = dto.demandScore;
    }

    const createData: Prisma.CarMarketDataCreateInput = {
      car: { connect: { id: carId } },
    };
    if (dto.avgPrice !== undefined) {
      createData.avgPrice = new Prisma.Decimal(dto.avgPrice);
    }
    if (dto.minPrice !== undefined) {
      createData.minPrice = new Prisma.Decimal(dto.minPrice);
    }
    if (dto.maxPrice !== undefined) {
      createData.maxPrice = new Prisma.Decimal(dto.maxPrice);
    }
    if (dto.adsCount !== undefined) createData.adsCount = dto.adsCount;
    if (dto.priceChange30d !== undefined) {
      createData.priceChange30d = new Prisma.Decimal(dto.priceChange30d);
    }
    if (dto.priceChange1y !== undefined) {
      createData.priceChange1y = new Prisma.Decimal(dto.priceChange1y);
    }
    if (dto.liquidityScore !== undefined) {
      createData.liquidityScore = dto.liquidityScore;
    }
    if (dto.depreciationRate30d !== undefined) {
      createData.depreciationRate30d = new Prisma.Decimal(
        dto.depreciationRate30d,
      );
    }
    if (dto.priceTrendScore !== undefined) {
      createData.priceTrendScore = dto.priceTrendScore;
    }
    if (dto.priceTrendLabel !== undefined) {
      createData.priceTrendLabel = dto.priceTrendLabel;
    }
    if (dto.demandScore !== undefined) {
      createData.demandScore = dto.demandScore;
    }

    return this.prisma.carMarketData.upsert({
      where: { carId },
      create: createData,
      update: data,
    });
  }
}
