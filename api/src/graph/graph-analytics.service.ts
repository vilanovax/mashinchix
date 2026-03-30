import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketCorrelationService } from './market-correlation.service';

@Injectable()
export class GraphAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly correlation: MarketCorrelationService,
  ) {}

  async segmentNeighborhood(segment: string) {
    const rels = await this.prisma.segmentRelationship.findMany({
      where: {
        OR: [{ segment }, { relatedSegment: segment }],
        methodology: 'kg-v1',
      },
      orderBy: { correlation: 'desc' },
      take: 40,
    });
    const seg = segment.trim();
    const cars = await this.prisma.car.findMany({
      where: {
        segment: { equals: seg, mode: 'insensitive' },
      },
      take: 30,
      include: { marketData: true, scores: true },
    });
    return { segment, relationships: rels, sampleCars: cars };
  }

  async marketNetworkSummary() {
    const [stats, segCount, carRelCount] = await Promise.all([
      this.correlation.graphStats(),
      this.prisma.segmentRelationship.count({ where: { methodology: 'kg-v1' } }),
      this.prisma.carRelationship.count({ where: { methodology: 'kg-v1' } }),
    ]);
    return {
      ...stats,
      totalSegmentEdges: segCount,
      totalCarEdges: carRelCount,
    };
  }

  /** جریان تقریبی «پول»: سگمنت‌ها بر اساس اخیر شاخص */
  async marketFlows(limit = 24) {
    const rows = await this.prisma.segmentMarketIndex.findMany({
      orderBy: { snapshotDate: 'desc' },
      take: 800,
    });
    const bySeg = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = bySeg.get(r.segment) ?? [];
      arr.push(r);
      bySeg.set(r.segment, arr);
    }
    const flows: Array<{
      segment: string;
      indexDelta: number;
      flowLabel: 'INFLOW' | 'NEUTRAL' | 'OUTFLOW';
    }> = [];
    for (const [seg, arr] of bySeg) {
      if (arr.length < 3) continue;
      const cur = arr[0]!.indexValue;
      const prev = arr[Math.min(4, arr.length - 1)]!.indexValue;
      const d = cur - prev;
      let flowLabel: 'INFLOW' | 'NEUTRAL' | 'OUTFLOW' = 'NEUTRAL';
      if (d > 0.8) flowLabel = 'INFLOW';
      else if (d < -0.8) flowLabel = 'OUTFLOW';
      flows.push({ segment: seg, indexDelta: d, flowLabel });
    }
    flows.sort((a, b) => b.indexDelta - a.indexDelta);
    return {
      methodology: 'segment-index-delta-v1',
      ranked: flows.slice(0, limit),
    };
  }
}
