import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';

/** استخراج مصرف لیتر به ازای ۱۰۰ کیلومتر از رشته فارسی/انگلیسی */
export function parseLitersPer100km(fuelConsumption: string | null | undefined): number | null {
  if (!fuelConsumption) return null;
  const faDigits = '۰۱۲۳۴۵۶۷۸۹';
  let s = '';
  for (const ch of fuelConsumption) {
    const i = faDigits.indexOf(ch);
    s += i >= 0 ? String(i) : ch;
  }
  const m = s.match(/(\d+\.?\d*)\s*(?:لیتر|l|L)/i);
  if (m) return Math.min(30, Math.max(2, parseFloat(m[1])));
  const m2 = s.match(/(\d+\.?\d*)/);
  if (m2) {
    const n = parseFloat(m2[1]);
    if (n >= 2 && n <= 30) return n;
  }
  return null;
}

@Injectable()
export class OwnershipCostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async recomputeForCar(carId: string): Promise<void> {
    const car = await this.prisma.car.findUnique({
      where: { id: carId },
      include: { specs: true, marketData: true },
    });
    if (!car) return;

    const fuelPrice = this.config.get<number>('FUEL_PRICE_PER_LITER_TOMANS') ?? 45_000;
    const kmPerMonth = this.config.get<number>('ASSUMED_KM_PER_MONTH') ?? 1_500;

    const l100 = parseLitersPer100km(car.specs?.fuelConsumption);
    let fuelMonthly: number | null = null;
    if (l100 != null) {
      fuelMonthly = Math.round((l100 / 100) * kmPerMonth * fuelPrice);
    }

    const year = car.year;
    const age = Math.max(0, 1403 - year);
    let maintenanceYearly = 12_000_000 + age * 1_800_000;
    const seg = (car.segment ?? '').toLowerCase();
    if (/لوکس|luxury|وارد/i.test(seg)) maintenanceYearly *= 1.6;
    if (/اقتصادی/i.test(seg)) maintenanceYearly *= 0.85;

    let depreciationAnnual: number | null = null;
    const md = car.marketData;
    if (md?.depreciationRate30d != null) {
      const d30 = toNumber(md.depreciationRate30d) ?? 0;
      depreciationAnnual = Math.round(
        Math.max(-0.6, Math.min(0.5, d30 * 12)) * 10000,
      ) / 10000;
    } else if (md?.priceChange1y != null) {
      const y = toNumber(md.priceChange1y) ?? 0;
      depreciationAnnual = Math.round(
        Math.max(-0.6, Math.min(0.5, -y)) * 10000,
      ) / 10000;
    }

    const methodology = 'v2 heuristic: fuel=l/100*km/month*price; maint=base+age*segment; deprec=monthly*12 or yearly';

    await this.prisma.ownershipCost.upsert({
      where: { carId },
      create: {
        carId,
        fuelMonthlyTomans:
          fuelMonthly != null ? new Prisma.Decimal(fuelMonthly) : null,
        maintenanceYearlyTomans: new Prisma.Decimal(
          Math.round(maintenanceYearly),
        ),
        depreciationAnnualRate:
          depreciationAnnual != null
            ? new Prisma.Decimal(depreciationAnnual)
            : null,
        methodology,
      },
      update: {
        fuelMonthlyTomans:
          fuelMonthly != null ? new Prisma.Decimal(fuelMonthly) : null,
        maintenanceYearlyTomans: new Prisma.Decimal(
          Math.round(maintenanceYearly),
        ),
        depreciationAnnualRate:
          depreciationAnnual != null
            ? new Prisma.Decimal(depreciationAnnual)
            : null,
        methodology,
        computedAt: new Date(),
      },
    });
  }

  async recomputeAll(): Promise<{ count: number }> {
    const cars = await this.prisma.car.findMany({ select: { id: true } });
    for (const c of cars) {
      await this.recomputeForCar(c.id);
    }
    return { count: cars.length };
  }
}
