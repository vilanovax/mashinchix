import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  addCalendarDays,
  loadPriceSeries,
  maxDrawdownFromPrices,
  priceOnOrBeforeDb,
  startOfUtcDay,
  subCalendarDays,
  volatilityOfReturns,
} from './eval-price.util';

/** تعداد نقطهٔ تاریخی برای هر خودرو (هر ۳۰ روز به عقب) */
const ANCHOR_STEPS = 12;

@Injectable()
export class InvestmentRiskEvaluationService {
  private readonly logger = new Logger(InvestmentRiskEvaluationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * امتیاز سرمایه‌گذاری و ریسک **فعلی** در برابر بازدهٔ realized از تاریخچه در نقاط snapshot گذشته.
   * توجه: امتیاز فعلی با گذشته تراز نیست؛ برای دقت بیشتر بعداً snapshot امتیاز لازم است.
   */
  async runScoreOutcomeEvaluation(asOf: Date = new Date()): Promise<{
    invested: number;
    risked: number;
  }> {
    const today = startOfUtcDay(asOf);
    const cars = await this.prisma.car.findMany({
      where: { scores: { isNot: null } },
      select: {
        id: true,
        scores: {
          select: { investmentScore: true, riskScore: true },
        },
      },
    });

    let invested = 0;
    let risked = 0;

    for (const c of cars) {
      const inv = c.scores?.investmentScore;
      const rk = c.scores?.riskScore;
      if (inv == null || rk == null) continue;

      for (let k = 1; k <= ANCHOR_STEPS; k++) {
        const snap = subCalendarDays(today, 30 * k);
        const p0 = await priceOnOrBeforeDb(this.prisma, c.id, snap);
        if (p0 == null || p0 <= 0) continue;

        const t30 = addCalendarDays(snap, 30);
        const t90 = addCalendarDays(snap, 90);
        const t180 = addCalendarDays(snap, 180);
        const p30 = await priceOnOrBeforeDb(this.prisma, c.id, t30);
        const p90 = await priceOnOrBeforeDb(this.prisma, c.id, t90);
        const p180 = await priceOnOrBeforeDb(this.prisma, c.id, t180);

        const ret30 = p30 != null && p30 > 0 ? p30 / p0 - 1 : null;
        const ret90 = p90 != null && p90 > 0 ? p90 / p0 - 1 : null;
        const ret180 = p180 != null && p180 > 0 ? p180 / p0 - 1 : null;

        const fwdEnd = addCalendarDays(snap, 30);
        const series = await loadPriceSeries(
          this.prisma,
          c.id,
          snap,
          fwdEnd,
        );
        const prices = series.map((x) => x.p);
        const vol =
          prices.length >= 5 ? volatilityOfReturns(prices) : null;
        const dd =
          prices.length >= 2 ? maxDrawdownFromPrices(prices) : null;

        await this.prisma.investmentScoreEvaluation.upsert({
          where: {
            carId_snapshotDate: { carId: c.id, snapshotDate: snap },
          },
          create: {
            carId: c.id,
            snapshotDate: snap,
            investmentScore: inv,
            return30d: ret30 ?? undefined,
            return90d: ret90 ?? undefined,
            return180d: ret180 ?? undefined,
            volatility: vol ?? undefined,
            drawdown: dd ?? undefined,
          },
          update: {
            investmentScore: inv,
            return30d: ret30 ?? undefined,
            return90d: ret90 ?? undefined,
            return180d: ret180 ?? undefined,
            volatility: vol ?? undefined,
            drawdown: dd ?? undefined,
          },
        });
        invested++;

        const fwdSeries = await loadPriceSeries(
          this.prisma,
          c.id,
          snap,
          addCalendarDays(snap, 60),
        );
        const fwdPrices = fwdSeries.map((x) => x.p);
        const fvol =
          fwdPrices.length >= 5 ? volatilityOfReturns(fwdPrices) : null;
        const fdd =
          fwdPrices.length >= 2 ? maxDrawdownFromPrices(fwdPrices) : null;
        const pEnd =
          fwdPrices.length > 0
            ? fwdPrices[fwdPrices.length - 1]
            : null;
        const futRet =
          p0 > 0 && pEnd != null && pEnd > 0 ? pEnd / p0 - 1 : null;

        await this.prisma.riskScoreEvaluation.upsert({
          where: {
            carId_snapshotDate: { carId: c.id, snapshotDate: snap },
          },
          create: {
            carId: c.id,
            snapshotDate: snap,
            riskScore: rk,
            futureVolatility: fvol ?? undefined,
            futureDrawdown: fdd ?? undefined,
            futureReturn: futRet ?? undefined,
          },
          update: {
            riskScore: rk,
            futureVolatility: fvol ?? undefined,
            futureDrawdown: fdd ?? undefined,
            futureReturn: futRet ?? undefined,
          },
        });
        risked++;
      }
    }

    this.logger.log(
      `InvestmentScoreEvaluation rows: ${invested}, RiskScoreEvaluation: ${risked}`,
    );
    return { invested, risked };
  }
}
