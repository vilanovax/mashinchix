import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

const SIGNAL_MARGIN = 10;

/**
 * سیگنال خرید/فروش از ترکیب روند، پیش‌بینی، نوسان، نقدشوندگی، تقاضا و افت قیمت.
 * باید پس از market-metrics و price-prediction (و ترجیحاً پس از car-scores) اجرا شود.
 */
@Injectable()
export class BuySellSignalService {
  private readonly logger = new Logger(BuySellSignalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recomputeForCar(carId: string): Promise<void> {
    const md = await this.prisma.carMarketData.findUnique({
      where: { carId },
    });
    if (!md) return;

    const pred = await this.prisma.pricePrediction.findUnique({
      where: { carId },
    });

    const vol = md.volatilityScore ?? 50;
    const liq = md.liquidityScore ?? 50;
    const dem = md.demandScore ?? 50;
    const dep =
      md.depreciationRate30d != null
        ? (toNumber(md.depreciationRate30d) ?? 0)
        : 0;
    const trend = md.priceTrendScore ?? 0;
    const p30 =
      pred?.predictedChange30d != null
        ? toNumber(pred.predictedChange30d) ?? 0
        : 0;

    let buy = 50;
    buy += p30 > 0 ? Math.min(22, p30 * 350) : Math.max(-12, p30 * 180);
    if (trend < -0.015) buy += 12;
    else if (trend > 0.035) buy -= 8;
    buy += (vol - 50) * 0.12;
    buy += (liq - 50) * 0.18;
    buy += Math.min(12, Math.max(-8, -dep * 70));
    buy = clamp(buy, 0, 100);

    let sell = 50;
    sell += p30 < 0 ? Math.min(24, -p30 * 380) : Math.max(-12, -p30 * 120);
    if (trend > 0.025) sell += 12;
    else if (trend < -0.04) sell -= 5;
    sell += (50 - vol) * 0.1;
    sell += (50 - dem) * 0.16;
    if (dep < -0.035) sell += 8;
    sell = clamp(sell, 0, 100);

    let marketSignal: string;
    if (buy >= sell + SIGNAL_MARGIN) marketSignal = 'BUY';
    else if (sell >= buy + SIGNAL_MARGIN) marketSignal = 'SELL';
    else marketSignal = 'HOLD';

    await this.prisma.carMarketData.update({
      where: { carId },
      data: {
        buyScore: Math.round(buy * 10) / 10,
        sellScore: Math.round(sell * 10) / 10,
        marketSignal,
      },
    });
  }

  async recomputeAll(): Promise<{ carsUpdated: number }> {
    const cars = await this.prisma.car.findMany({
      where: { marketData: { isNot: null } },
      select: { id: true },
    });
    for (const c of cars) {
      await this.recomputeForCar(c.id);
    }
    this.logger.log(`Buy/sell signals for ${cars.length} cars`);
    return { carsUpdated: cars.length };
  }

  async getMarketSignalForCar(carId: string) {
    const md = await this.prisma.carMarketData.findUnique({
      where: { carId },
    });
    if (!md) {
      return {
        carId,
        buyScore: null,
        sellScore: null,
        marketSignal: null,
        drivers: null,
      };
    }

    const pred = await this.prisma.pricePrediction.findUnique({
      where: { carId },
    });

    return {
      carId,
      buyScore: md.buyScore,
      sellScore: md.sellScore,
      marketSignal: md.marketSignal,
      drivers: {
        priceTrendScore: md.priceTrendScore,
        predictedChange30d: pred?.predictedChange30d
          ? toNumber(pred.predictedChange30d)
          : null,
        volatilityScore: md.volatilityScore,
        liquidityScore: md.liquidityScore,
        demandScore: md.demandScore,
        depreciationRate30d: md.depreciationRate30d
          ? toNumber(md.depreciationRate30d)
          : null,
      },
    };
  }
}
