import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateScoresDto } from './dto/update-scores.dto';

@Injectable()
export class ScoresService {
  constructor(private readonly prisma: PrismaService) {}

  async updateForCar(carId: string, dto: UpdateScoresDto) {
    const car = await this.prisma.car.findUnique({ where: { id: carId } });
    if (!car) {
      throw new NotFoundException(`Car ${carId} not found`);
    }

    const data: Prisma.CarScoresUpdateInput = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (data as Record<string, number>)[key] = value as number;
      }
    }

    const createData: Prisma.CarScoresCreateInput = {
      car: { connect: { id: carId } },
      ...Object.fromEntries(
        Object.entries(dto).filter(([, v]) => v !== undefined),
      ),
    };

    return this.prisma.carScores.upsert({
      where: { carId },
      create: createData,
      update: data,
    });
  }
}
