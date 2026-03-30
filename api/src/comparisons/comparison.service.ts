import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';

const carInclude = {
  specs: true,
  marketData: true,
  scores: true,
} satisfies Prisma.CarInclude;

type CarCompare = Prisma.CarGetPayload<{ include: typeof carInclude }>;

function n(v: number | null | undefined, fallback = 50): number {
  return v ?? fallback;
}

/** برنده: carId برنده یا 'tie' */
function pick(
  aId: string,
  bId: string,
  aVal: number,
  bVal: number,
): string {
  if (Math.abs(aVal - bVal) < 0.05) return 'tie';
  return aVal > bVal ? aId : bId;
}

function familyScore(s: CarCompare['scores']): number {
  if (!s) return 50;
  return (
    n(s.comfortScore) * 0.4 +
    n(s.reliabilityScore) * 0.4 +
    n(s.marketScore) * 0.2
  );
}

function cityScore(s: CarCompare['scores']): number {
  if (!s) return 50;
  return (
    n(s.economyScore) * 0.45 +
    n(s.comfortScore) * 0.35 +
    (100 - n(s.riskScore)) * 0.2
  );
}

function tripScore(s: CarCompare['scores']): number {
  if (!s) return 50;
  return (
    n(s.comfortScore) * 0.45 +
    n(s.reliabilityScore) * 0.35 +
    n(s.economyScore) * 0.2
  );
}

function investmentScore(s: CarCompare['scores']): number {
  if (!s) return 50;
  return (
    n(s.marketScore) * 0.45 +
    n(s.reliabilityScore) * 0.35 +
    (100 - n(s.riskScore)) * 0.2
  );
}

@Injectable()
export class ComparisonService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(car: CarCompare) {
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

  async compare(carAId: string, carBId: string) {
    if (!carAId || !carBId) {
      throw new BadRequestException('Query params "a" and "b" (car ids) are required');
    }
    if (carAId === carBId) {
      throw new BadRequestException('Choose two different cars');
    }

    const [carA, carB] = await Promise.all([
      this.prisma.car.findUnique({ where: { id: carAId }, include: carInclude }),
      this.prisma.car.findUnique({ where: { id: carBId }, include: carInclude }),
    ]);

    if (!carA) throw new NotFoundException(`Car ${carAId} not found`);
    if (!carB) throw new NotFoundException(`Car ${carBId} not found`);

    const sa = carA.scores;
    const sb = carB.scores;

    const winners = {
      economic: pick(carA.id, carB.id, n(sa?.economyScore), n(sb?.economyScore)),
      family: pick(carA.id, carB.id, familyScore(sa), familyScore(sb)),
      sport: pick(
        carA.id,
        carB.id,
        n(sa?.performanceScore),
        n(sb?.performanceScore),
      ),
      city: pick(carA.id, carB.id, cityScore(sa), cityScore(sb)),
      trip: pick(carA.id, carB.id, tripScore(sa), tripScore(sb)),
      investment: pick(
        carA.id,
        carB.id,
        investmentScore(sa),
        investmentScore(sb),
      ),
    };

    return {
      carA: this.serialize(carA),
      carB: this.serialize(carB),
      winners,
    };
  }
}
