import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';

@Injectable()
export class PriceHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getForCar(carId: string) {
    const car = await this.prisma.car.findUnique({ where: { id: carId } });
    if (!car) {
      throw new NotFoundException(`Car ${carId} not found`);
    }

    const rows = await this.prisma.priceHistory.findMany({
      where: { carId },
      orderBy: { date: 'asc' },
    });

    return rows.map((r) => ({
      id: r.id,
      carId: r.carId,
      date: r.date.toISOString().slice(0, 10),
      price: toNumber(r.price),
      listingCount: r.listingCount ?? null,
    }));
  }
}
