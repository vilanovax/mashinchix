import { Injectable, Logger } from '@nestjs/common';
import { MarketCycleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

@Injectable()
export class MarketCycleService {
  private readonly logger = new Logger(MarketCycleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * چرخهٔ بازار per segment از دو نقطهٔ اخیر SegmentMarketIndex + روندهای نقدشوندگی/تقاضا/پیش‌بینی
   */
  async recomputeAll(dateInput?: string): Promise<{
    snapshotDate: string;
    segments: number;
  }> {
    const snapshotDate = startOfUtcDay(
      dateInput?.trim() ?
        new Date(`${dateInput.trim()}T12:00:00.000Z`)
      : new Date(),
    );

    const segments = await this.prisma.car.findMany({
      where: { segment: { not: null } },
      distinct: ['segment'],
      select: { segment: true },
    });

    let n = 0;
    for (const { segment: seg } of segments) {
      if (!seg?.trim()) continue;
      const segment = seg.trim();

      const rows = await this.prisma.segmentMarketIndex.findMany({
        where: { segment },
        orderBy: { snapshotDate: 'desc' },
        take: 2,
      });

      let cycleType: MarketCycleType = MarketCycleType.STABLE;
      let confidenceScore = 0.35;
      const methodology =
        'v1: indexDelta + liquidityAvgDelta + predChangeDelta (last vs prev snapshot)';

      if (rows.length >= 2) {
        const [cur, prev] = rows;
        const idxD = cur.indexValue - prev.indexValue;
        const liqD =
          (cur.liquidityAvg ?? 50) - (prev.liquidityAvg ?? 50);
        const demD = (cur.demandAvg ?? 50) - (prev.demandAvg ?? 50);
        const predD =
          (cur.avgPredictedChange30d ?? 0) -
          (prev.avgPredictedChange30d ?? 0);

        let score = 0;
        score += clamp(idxD * 0.55, -28, 28);
        score += clamp(liqD * 0.35, -22, 22);
        score += clamp(demD * 0.25, -18, 18);
        score += clamp(predD * 380, -24, 24);

        if (score > 14) cycleType = MarketCycleType.BULL;
        else if (score < -14) cycleType = MarketCycleType.BEAR;

        confidenceScore = Math.round(
          Math.min(0.95, 0.38 + Math.abs(score) / 72) * 100,
        ) / 100;
      }

      await this.prisma.marketCycle.upsert({
        where: {
          segment_snapshotDate: { segment, snapshotDate },
        },
        create: {
          segment,
          snapshotDate,
          cycleType,
          confidenceScore,
          methodology,
        },
        update: {
          cycleType,
          confidenceScore,
          methodology,
        },
      });
      n += 1;
    }

    const ds = snapshotDate.toISOString().slice(0, 10);
    this.logger.log(`MarketCycle ${ds}: ${n} segments`);
    return { snapshotDate: ds, segments: n };
  }
}
