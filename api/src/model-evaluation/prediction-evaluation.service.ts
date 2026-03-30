import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';
import {
  addCalendarDays,
  priceOnOrAfter,
  startOfUtcDay,
} from './eval-price.util';

function modelVersionSlug(m: string | null | undefined): string {
  const s = (m ?? 'price-trend-default').trim();
  return s.length > 100 ? s.slice(0, 100) : s;
}

@Injectable()
export class PredictionEvaluationService {
  private readonly logger = new Logger(PredictionEvaluationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** پر کردن / به‌روزرسانی خطا وقتی قیمت واقعی در افق در دسترس است */
  async runEvaluation(asOf: Date = new Date()): Promise<{ upserted: number }> {
    const today = startOfUtcDay(asOf);
    const preds = await this.prisma.pricePrediction.findMany({
      select: {
        carId: true,
        computedAt: true,
        predictedPrice30d: true,
        predictedPrice90d: true,
        methodology: true,
      },
    });

    let upserted = 0;

    for (const p of preds) {
      const predDate = startOfUtcDay(p.computedAt);
      const mv = modelVersionSlug(p.methodology);

      for (const horizon of [30, 90] as const) {
        const targetDate = addCalendarDays(predDate, horizon);
        if (today.getTime() < targetDate.getTime()) continue;

        const predDec =
          horizon === 30 ? p.predictedPrice30d : p.predictedPrice90d;
        if (predDec == null) continue;
        const predictedPrice = toNumber(predDec);
        if (predictedPrice == null || predictedPrice <= 0) continue;

        const actualRaw = await priceOnOrAfter(this.prisma, p.carId, targetDate);
        if (actualRaw == null || actualRaw <= 0) continue;

        const error = actualRaw - predictedPrice;
        const absError = Math.abs(error);
        const pctError =
          predictedPrice !== 0 ? error / predictedPrice : null;

        await this.prisma.predictionEvaluation.upsert({
          where: {
            carId_predictionDate_horizonDays_modelVersion: {
              carId: p.carId,
              predictionDate: predDate,
              horizonDays: horizon,
              modelVersion: mv,
            },
          },
          create: {
            carId: p.carId,
            predictionDate: predDate,
            targetDate,
            horizonDays: horizon,
            predictedPrice: new Prisma.Decimal(predictedPrice),
            actualPrice: new Prisma.Decimal(actualRaw),
            error,
            absError,
            pctError: pctError ?? undefined,
            modelVersion: mv,
          },
          update: {
            predictedPrice: new Prisma.Decimal(predictedPrice),
            actualPrice: new Prisma.Decimal(actualRaw),
            error,
            absError,
            pctError: pctError ?? undefined,
            targetDate,
          },
        });
        upserted++;
      }
    }

    this.logger.log(`PredictionEvaluation upserted: ${upserted}`);
    return { upserted };
  }
}
