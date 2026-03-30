import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

@Injectable()
export class SegmentMarketIndexService {
  private readonly logger = new Logger(SegmentMarketIndexService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * برای هر سگمنت: میانگین نقدشوندگی، تقاضا و پیش‌بینی تغییر ۳۰روزه → شاخص ۰–۱۰۰.
   */
  async recomputeAll(): Promise<{ segmentsUpdated: number }> {
    const snapshotDate = startOfUtcDay(new Date());

    const cars = await this.prisma.car.findMany({
      where: {
        segment: { not: null },
        NOT: { segment: '' },
      },
      select: {
        segment: true,
        marketData: true,
        pricePrediction: true,
      },
    });

    const bySeg = new Map<
      string,
      {
        liquidity: number[];
        demand: number[];
        pred: number[];
      }
    >();
    const segmentCounts = new Map<string, number>();

    for (const c of cars) {
      const seg = c.segment!.trim();
      if (!seg) continue;
      segmentCounts.set(seg, (segmentCounts.get(seg) ?? 0) + 1);
      let g = bySeg.get(seg);
      if (!g) {
        g = { liquidity: [], demand: [], pred: [] };
        bySeg.set(seg, g);
      }
      const md = c.marketData;
      if (md?.liquidityScore != null) {
        g.liquidity.push(md.liquidityScore);
      }
      if (md?.demandScore != null) {
        g.demand.push(md.demandScore);
      }
      const ch = c.pricePrediction?.predictedChange30d;
      if (ch != null) {
        const p = toNumber(ch);
        if (p != null) g.pred.push(p);
      }
    }

    let n = 0;
    for (const [segment, g] of bySeg) {
      const carCount = segmentCounts.get(segment) ?? 0;
      const avgL =
        g.liquidity.length > 0
          ? g.liquidity.reduce((a, b) => a + b, 0) /
            g.liquidity.length
          : null;
      const avgD =
        g.demand.length > 0
          ? g.demand.reduce((a, b) => a + b, 0) / g.demand.length
          : null;
      const avgP =
        g.pred.length > 0
          ? g.pred.reduce((a, b) => a + b, 0) / g.pred.length
          : null;

      const L = avgL ?? 50;
      const Dem = avgD ?? 50;
      const mom = avgP ?? 0;
      const indexValue = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (50 + mom * 180 + 0.22 * L + 0.22 * Dem + carCount * 0.05) *
              10,
          ) / 10,
        ),
      );

      await this.prisma.segmentMarketIndex.upsert({
        where: {
          segment_snapshotDate: { segment, snapshotDate },
        },
        create: {
          segment,
          snapshotDate,
          indexValue,
          avgPredictedChange30d: avgP,
          liquidityAvg: avgL,
          demandAvg: avgD,
          carCount,
          methodology:
            'v1: 50 + 180*avgPred30d + 0.22*liquidity + 0.22*demand + 0.05*count',
        },
        update: {
          indexValue,
          avgPredictedChange30d: avgP,
          liquidityAvg: avgL,
          demandAvg: avgD,
          carCount,
          methodology:
            'v1: 50 + 180*avgPred30d + 0.22*liquidity + 0.22*demand + 0.05*count',
        },
      });
      n += 1;
    }

    this.logger.log(`SegmentMarketIndex snapshots: ${n} segments`);
    return { segmentsUpdated: n };
  }
}
