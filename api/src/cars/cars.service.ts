import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';
import { PriceHistoryService } from '../price-history/price-history.service';
import { QueryCarsDto } from './dto/query-cars.dto';

const carInclude = {
  specs: true,
  marketData: true,
  scores: true,
} satisfies Prisma.CarInclude;

export type CarWithRelations = Prisma.CarGetPayload<{
  include: typeof carInclude;
}>;

@Injectable()
export class CarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceHistory: PriceHistoryService,
  ) {}

  private serializeCar(car: CarWithRelations) {
    return {
      id: car.id,
      brand: car.brand,
      model: car.model,
      year: car.year,
      bodyType: car.bodyType,
      segment: car.segment,
      image: car.image,
      pros: car.pros,
      cons: car.cons,
      specs: car.specs,
      marketData: car.marketData
        ? {
            ...car.marketData,
            avgPrice: toNumber(car.marketData.avgPrice),
            minPrice: toNumber(car.marketData.minPrice),
            maxPrice: toNumber(car.marketData.maxPrice),
            priceChange30d: toNumber(car.marketData.priceChange30d),
            priceChange1y: toNumber(car.marketData.priceChange1y),
            depreciationRate30d: toNumber(
              car.marketData.depreciationRate30d,
            ),
          }
        : null,
      scores: car.scores,
    };
  }

  async findAll(query: QueryCarsDto) {
    const where: Prisma.CarWhereInput = {};

    if (query.segment) {
      where.segment = { contains: query.segment };
    }

    if (query.minPrice != null || query.maxPrice != null) {
      const md: Prisma.CarMarketDataWhereInput = {};
      if (query.minPrice != null && query.maxPrice != null) {
        md.avgPrice = { gte: query.minPrice, lte: query.maxPrice };
      } else if (query.minPrice != null) {
        md.avgPrice = { gte: query.minPrice };
      } else if (query.maxPrice != null) {
        md.avgPrice = { lte: query.maxPrice };
      }
      where.marketData = { is: md };
    }

    const orderBy: Prisma.CarOrderByWithRelationInput[] = [];
    switch (query.sort) {
      case 'price_asc':
        orderBy.push({ marketData: { avgPrice: 'asc' } });
        break;
      case 'price_desc':
        orderBy.push({ marketData: { avgPrice: 'desc' } });
        break;
      case 'ads':
        orderBy.push({ marketData: { adsCount: 'desc' } });
        break;
      case 'liquidity':
        orderBy.push({ marketData: { liquidityScore: 'desc' } });
        break;
      case 'score':
      default:
        orderBy.push({ scores: { overallScore: 'desc' } });
        break;
    }
    orderBy.push({ brand: 'asc' }, { model: 'asc' });

    const take = query.limit ?? 50;

    const cars = await this.prisma.car.findMany({
      where,
      include: carInclude,
      orderBy,
      take,
    });

    return cars.map((c) => this.serializeCar(c));
  }

  async findOne(id: string) {
    const car = await this.prisma.car.findUnique({
      where: { id },
      include: carInclude,
    });
    if (!car) {
      throw new NotFoundException(`Car ${id} not found`);
    }
    return this.serializeCar(car);
  }

  async getPriceHistory(id: string) {
    return this.priceHistory.getForCar(id);
  }
}
