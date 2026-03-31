import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { WeightRow } from '../execution/execution-portfolio-apply.util';

const EPS = 1e-6;

function parseWeightRows(json: unknown): WeightRow[] {
  if (!Array.isArray(json)) return [];
  const out: WeightRow[] = [];
  for (const row of json) {
    if (row && typeof row === 'object') {
      const r = row as { carId?: string; weight?: number };
      if (r.carId && typeof r.weight === 'number' && Number.isFinite(r.weight)) {
        out.push({ carId: r.carId, weight: r.weight });
      }
    }
  }
  return out;
}

function weightMap(rows: WeightRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r.carId, (m.get(r.carId) ?? 0) + r.weight);
  }
  return m;
}

@Injectable()
export class PortfolioLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreatePortfolio(userId: string) {
    const existing = await this.prisma.portfolio.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;
    return this.prisma.portfolio.create({
      data: { userId, name: 'سبد اصلی', baseCurrency: 'IRR' },
    });
  }

  private async baseNotional(userId: string): Promise<number> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { budget: true },
    });
    const b = u?.budget != null ? Number(u.budget) : NaN;
    return Number.isFinite(b) && b > 0 ? b : 10_000_000;
  }

  async createTransaction(data: {
    portfolioId: string;
    assetId: string;
    assetType: string;
    type: string;
    quantity: number;
    price: number;
    amount: number;
    fee?: number | null;
    executionResultId?: string | null;
    executedAt: Date;
  }) {
    return this.prisma.portfolioTransaction.create({
      data: {
        portfolioId: data.portfolioId,
        assetId: data.assetId,
        assetType: data.assetType,
        type: data.type,
        quantity: data.quantity,
        price: data.price,
        amount: data.amount,
        fee: data.fee ?? null,
        executionResultId: data.executionResultId ?? null,
        executedAt: data.executedAt,
      },
    });
  }

  /**
   * موقعیت‌ها را از اسنپ‌شات وزنی پس از اجرا می‌سازد و قیمت‌ها را از CarMarketData می‌گیرد.
   */
  async syncPositionsFromWeights(
    portfolioId: string,
    afterWeights: WeightRow[],
    totalValue: number,
  ) {
    const m = weightMap(afterWeights);
    const sumW = [...m.values()].reduce((a, w) => a + w, 0);
    const cashW = Math.max(0, 1 - sumW);
    const carIds = [...m.keys()];

    const prices =
      carIds.length > 0
        ? await this.prisma.carMarketData.findMany({
            where: { carId: { in: carIds } },
            select: { carId: true, avgPrice: true },
          })
        : [];
    const priceByCar = new Map(
      prices.map((p) => [
        p.carId,
        p.avgPrice != null ? Number(p.avgPrice) : 0,
      ]),
    );

    await this.prisma.portfolioPosition.deleteMany({ where: { portfolioId } });

    const creates: Prisma.PortfolioPositionCreateManyInput[] = [];

    for (const [carId, w] of m) {
      if (w < EPS) continue;
      const px = priceByCar.get(carId) ?? 0;
      const marketValue = totalValue * w;
      const quantity = px > EPS ? marketValue / px : w;
      creates.push({
        portfolioId,
        assetId: carId,
        assetType: 'CAR',
        quantity,
        avgPrice: px > EPS ? px : null,
        marketValue,
        weight: w,
      });
    }

    if (cashW > EPS) {
      const cashValue = totalValue * cashW;
      creates.push({
        portfolioId,
        assetId: 'CASH',
        assetType: 'CASH',
        quantity: cashValue,
        avgPrice: 1,
        marketValue: cashValue,
        weight: cashW,
      });
    }

    if (creates.length) {
      await this.prisma.portfolioPosition.createMany({ data: creates });
    }
  }

  async recomputePositions(portfolioId: string) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });
    if (!portfolio) throw new NotFoundException('سبد یافت نشد');

    const positions = await this.prisma.portfolioPosition.findMany({
      where: { portfolioId },
    });
    if (!positions.length) return { updated: 0 };

    const carPositions = positions.filter((p) => p.assetType === 'CAR');
    const cashPos = positions.find((p) => p.assetType === 'CASH');

    let totalValue = positions.reduce((s, p) => s + (p.marketValue ?? 0), 0);
    if (totalValue < EPS) {
      totalValue = await this.baseNotional(portfolio.userId);
    }

    const carIds = carPositions.map((p) => p.assetId);
    const prices =
      carIds.length > 0
        ? await this.prisma.carMarketData.findMany({
            where: { carId: { in: carIds } },
            select: { carId: true, avgPrice: true },
          })
        : [];
    const priceByCar = new Map(
      prices.map((p) => [
        p.carId,
        p.avgPrice != null ? Number(p.avgPrice) : 0,
      ]),
    );

    let updated = 0;
    for (const pos of carPositions) {
      const px = priceByCar.get(pos.assetId) ?? pos.avgPrice ?? 0;
      const w = pos.weight ?? 0;
      const mv = totalValue * w;
      const qty = px > EPS ? mv / px : w;
      await this.prisma.portfolioPosition.update({
        where: { id: pos.id },
        data: {
          avgPrice: px > EPS ? px : null,
          marketValue: mv,
          quantity: qty,
        },
      });
      updated++;
    }

    if (cashPos) {
      const cashW = cashPos.weight ?? 0;
      const cashMv = totalValue * cashW;
      await this.prisma.portfolioPosition.update({
        where: { id: cashPos.id },
        data: {
          quantity: cashMv,
          marketValue: cashMv,
        },
      });
    }

    return { updated };
  }

  async recomputePortfolioValue(portfolioId: string) {
    const positions = await this.prisma.portfolioPosition.findMany({
      where: { portfolioId },
    });
    const invested = positions
      .filter((p) => p.assetType === 'CAR')
      .reduce((s, p) => s + (p.marketValue ?? 0), 0);
    const cash =
      positions.find((p) => p.assetType === 'CASH')?.marketValue ?? 0;
    return {
      totalValue: invested + cash,
      cashValue: cash,
      investedValue: invested,
    };
  }

  async createDailySnapshot(portfolioId: string, at = new Date()) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });
    if (!portfolio) throw new NotFoundException('سبد یافت نشد');

    await this.recomputePositions(portfolioId);
    const v = await this.recomputePortfolioValue(portfolioId);

    const positions = await this.prisma.portfolioPosition.findMany({
      where: { portfolioId },
      orderBy: { marketValue: 'desc' },
    });

    const carIds = positions
      .filter((p) => p.assetType === 'CAR')
      .map((p) => p.assetId);
    const cars =
      carIds.length > 0
        ? await this.prisma.car.findMany({
            where: { id: { in: carIds } },
            select: { id: true, brand: true, model: true, segment: true },
          })
        : [];
    const carMeta = new Map(cars.map((c) => [c.id, c]));

    const positionsJson = positions.map((p) => {
      const c =
        p.assetType === 'CAR' ? carMeta.get(p.assetId) : undefined;
      return {
        assetId: p.assetId,
        assetType: p.assetType,
        label:
          c != null
            ? `${c.brand} ${c.model}`
            : p.assetId === 'CASH'
              ? 'نقد'
              : p.assetId,
        segment: c?.segment ?? null,
        quantity: p.quantity,
        weight: p.weight,
        avgPrice: p.avgPrice,
        marketValue: p.marketValue,
      };
    });

    const prev = await this.prisma.portfolioSnapshot.findFirst({
      where: { portfolioId },
      orderBy: { snapshotDate: 'desc' },
    });

    const ret1d =
      prev && prev.totalValue > EPS
        ? (v.totalValue - prev.totalValue) / prev.totalValue
        : null;

    const history = await this.prisma.portfolioSnapshot.findMany({
      where: { portfolioId },
      orderBy: { snapshotDate: 'desc' },
      take: 120,
      select: { totalValue: true, snapshotDate: true },
    });

    const returns = history
      .slice(0, -1)
      .map((h, i) => {
        const older = history[i + 1];
        if (!older || older.totalValue < EPS) return null;
        return (h.totalValue - older.totalValue) / older.totalValue;
      })
      .filter((x): x is number => x != null && Number.isFinite(x));

    const mean =
      returns.length > 0
        ? returns.reduce((a, b) => a + b, 0) / returns.length
        : null;
    const variance =
      returns.length > 1
        ? returns.reduce((s, x) => s + (x - (mean ?? 0)) ** 2, 0) /
          (returns.length - 1)
        : null;
    const vol = variance != null && variance > 0 ? Math.sqrt(variance) : null;
    const sharpe =
      vol != null && vol > EPS && mean != null ? mean / vol : null;

    let peak = -Infinity;
    let maxDd = 0;
    for (const h of [...history].reverse()) {
      if (h.totalValue > peak) peak = h.totalValue;
      if (peak > EPS) {
        const dd = (h.totalValue - peak) / peak;
        if (dd < maxDd) maxDd = dd;
      }
    }

    return this.prisma.portfolioSnapshot.create({
      data: {
        portfolioId,
        snapshotDate: at,
        totalValue: v.totalValue,
        cashValue: v.cashValue,
        investedValue: v.investedValue,
        return1d: ret1d,
        return7d: null,
        return30d: null,
        return90d: null,
        sharpe,
        volatility: vol,
        drawdown: maxDd < 0 ? maxDd : null,
        positions: positionsJson as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * پس از ثبت ExecutionResult: تراکنش‌های اختلاف وزن، به‌روزرسانی موقعیت، اسنپ‌شات.
   */
  async applyExecutionResult(executionResultId: string) {
    const result = await this.prisma.executionResult.findUnique({
      where: { id: executionResultId },
      include: { plan: { select: { userId: true } } },
    });
    if (!result) throw new NotFoundException('نتیجهٔ اجرا یافت نشد');

    const userId = result.userId ?? result.plan.userId;
    if (!userId) {
      throw new BadRequestException('userId برای دفتر کل نیاز است');
    }

    const portfolio = await this.getOrCreatePortfolio(userId);
    const notional = await this.baseNotional(userId);
    const scale = 1 + (result.realizedReturn ?? 0) * 0.02;
    const totalValue = Math.max(EPS, notional * scale);

    const before = parseWeightRows(result.portfolioBefore);
    const after = parseWeightRows(result.portfolioAfter);
    const bMap = weightMap(before);
    const aMap = weightMap(after);
    const keys = new Set([...bMap.keys(), ...aMap.keys()]);

    const carIds = [...keys];
    const prices =
      carIds.length > 0
        ? await this.prisma.carMarketData.findMany({
            where: { carId: { in: carIds } },
            select: { carId: true, avgPrice: true },
          })
        : [];
    const priceByCar = new Map(
      prices.map((p) => [
        p.carId,
        p.avgPrice != null ? Number(p.avgPrice) : 0,
      ]),
    );

    const feeUnit =
      (result.transactionCost != null ? Number(result.transactionCost) : 0) /
      Math.max(1, keys.size);

    const executedAt = result.executedAt;

    for (const carId of keys) {
      const dw = (aMap.get(carId) ?? 0) - (bMap.get(carId) ?? 0);
      if (Math.abs(dw) < EPS) continue;

      const px = priceByCar.get(carId) ?? 0;
      const amount =
        px > EPS ? Math.abs(dw) * px : Math.abs(dw) * totalValue;
      const type =
        dw > 0 ? 'BUY' : 'SELL';
      await this.createTransaction({
        portfolioId: portfolio.id,
        assetId: carId,
        assetType: 'CAR',
        type,
        quantity: Math.abs(dw),
        price: px > EPS ? px : 1,
        amount,
        fee: feeUnit,
        executionResultId: result.id,
        executedAt,
      });
    }

    const afterRows: WeightRow[] = [...aMap].map(([carId, weight]) => ({
      carId,
      weight,
    }));

    await this.syncPositionsFromWeights(
      portfolio.id,
      afterRows,
      totalValue,
    );

    const snap = await this.createDailySnapshot(portfolio.id, executedAt);

    return { portfolioId: portfolio.id, snapshotId: snap.id };
  }

  async getPortfolioState(userId: string) {
    const portfolio = await this.getOrCreatePortfolio(userId);
    await this.recomputePositions(portfolio.id);
    const v = await this.recomputePortfolioValue(portfolio.id);

    const positions = await this.prisma.portfolioPosition.findMany({
      where: { portfolioId: portfolio.id },
      orderBy: { marketValue: 'desc' },
    });

    const carIds = positions
      .filter((p) => p.assetType === 'CAR')
      .map((p) => p.assetId);
    const cars =
      carIds.length > 0
        ? await this.prisma.car.findMany({
            where: { id: { in: carIds } },
            select: { id: true, brand: true, model: true },
          })
        : [];
    const labels = new Map(
      cars.map((c) => [c.id, `${c.brand} ${c.model}`]),
    );

    const latest = await this.prisma.portfolioSnapshot.findFirst({
      where: { portfolioId: portfolio.id },
      orderBy: { snapshotDate: 'desc' },
    });

    return {
      portfolioId: portfolio.id,
      totalValue: v.totalValue,
      cash: v.cashValue,
      invested: v.investedValue,
      return30d: latest?.return30d ?? null,
      sharpe: latest?.sharpe ?? null,
      drawdown: latest?.drawdown ?? null,
      positions: positions
        .filter((p) => p.assetType === 'CAR')
        .map((p) => ({
          asset: labels.get(p.assetId) ?? p.assetId,
          assetId: p.assetId,
          weight:
            v.totalValue > EPS
              ? (p.marketValue ?? 0) / v.totalValue
              : p.weight ?? 0,
          value: p.marketValue ?? 0,
        })),
    };
  }
}
