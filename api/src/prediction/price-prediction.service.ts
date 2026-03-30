import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';
import { linearRegression, rSquared } from './price-trend.util';

const MIN_POINTS = 3;
const METHODOLOGY_OK =
  'ols_linear_days_since_first_vs_price_tomans_v1';

@Injectable()
export class PricePredictionService {
  private readonly logger = new Logger(PricePredictionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recomputeForCar(carId: string): Promise<void> {
    const rawRows = await this.prisma.priceHistory.findMany({
      where: { carId },
      orderBy: { date: 'asc' },
    });
    const rows = rawRows.filter((r) => toNumber(r.price) != null);

    if (rows.length < MIN_POINTS) {
      await this.prisma.pricePrediction.upsert({
        where: { carId },
        create: {
          carId,
          predictedPrice30d: null,
          predictedPrice90d: null,
          predictedChange30d: null,
          predictedChange90d: null,
          confidence: 0,
          historyPointsUsed: rawRows.length,
          methodology: `insufficient_history_need_${MIN_POINTS}`,
        },
        update: {
          predictedPrice30d: null,
          predictedPrice90d: null,
          predictedChange30d: null,
          predictedChange90d: null,
          confidence: 0,
          historyPointsUsed: rawRows.length,
          methodology: `insufficient_history_need_${MIN_POINTS}`,
        },
      });
      return;
    }

    const firstMs = rows[0].date.getTime();
    const dayMs = 86_400_000;
    const t = rows.map((r) => (r.date.getTime() - firstMs) / dayMs);
    const y = rows.map((r) => toNumber(r.price)!);

    const { slope, intercept } = linearRegression(t, y);
    const tLast = t[t.length - 1];
    const yLast = y[y.length - 1];
    const r2 = rSquared(t, y, slope, intercept);
    const ptsFactor = Math.min(1, rows.length / 24);
    const confidence = Math.round(ptsFactor * r2 * 1000) / 1000;

    const y30 = intercept + slope * (tLast + 30);
    const y90 = intercept + slope * (tLast + 90);
    const pred30 = Math.max(0, Math.round(y30));
    const pred90 = Math.max(0, Math.round(y90));

    const ch30 =
      yLast > 0 ? (pred30 - yLast) / yLast : null;
    const ch90 =
      yLast > 0 ? (pred90 - yLast) / yLast : null;

    await this.prisma.pricePrediction.upsert({
      where: { carId },
      create: {
        carId,
        predictedPrice30d: new Prisma.Decimal(pred30),
        predictedPrice90d: new Prisma.Decimal(pred90),
        predictedChange30d:
          ch30 != null ? new Prisma.Decimal(ch30) : null,
        predictedChange90d:
          ch90 != null ? new Prisma.Decimal(ch90) : null,
        confidence,
        historyPointsUsed: rows.length,
        methodology: METHODOLOGY_OK,
      },
      update: {
        predictedPrice30d: new Prisma.Decimal(pred30),
        predictedPrice90d: new Prisma.Decimal(pred90),
        predictedChange30d:
          ch30 != null ? new Prisma.Decimal(ch30) : null,
        predictedChange90d:
          ch90 != null ? new Prisma.Decimal(ch90) : null,
        confidence,
        historyPointsUsed: rows.length,
        methodology: METHODOLOGY_OK,
      },
    });
  }

  async recomputeAll(): Promise<{ carsUpdated: number }> {
    const cars = await this.prisma.car.findMany({ select: { id: true } });
    for (const c of cars) {
      await this.recomputeForCar(c.id);
    }
    this.logger.log(`PricePrediction recomputed for ${cars.length} cars`);
    return { carsUpdated: cars.length };
  }
}
