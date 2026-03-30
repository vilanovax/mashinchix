import { Injectable, Logger } from '@nestjs/common';
import {
  CarGraphRelationType,
  SegmentGraphRelationType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  alignedIndexReturns,
  pearsonFromMaps,
  priceRowsToDayMap,
} from './correlation-series.util';
import { priceBandSimilarity, specSimilarity } from './graph-spec-sim.util';
import { pearsonCorrelation } from '../model-evaluation/eval-math.util';

const KG_TAG = 'kg-v1';

@Injectable()
export class MarketCorrelationService {
  private readonly logger = new Logger(MarketCorrelationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * بازسازی یال‌های مشتق‌شدهٔ گراف (دادهٔ قابل احتساب مجدد).
   * ردیف‌های با methodology=kg-v1 حذف و دوباره پر می‌شوند.
   */
  async recomputeKnowledgeGraph(options?: {
    historyDays?: number;
    maxCarsPerSegment?: number;
  }): Promise<{
    segmentEdges: number;
    carEdges: number;
    similarityRows: number;
  }> {
    const days = options?.historyDays ?? 200;
    const maxC = Math.min(Math.max(options?.maxCarsPerSegment ?? 28, 8), 45);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);

    await this.prisma.$transaction([
      this.prisma.carRelationship.deleteMany({ where: { methodology: KG_TAG } }),
      this.prisma.segmentRelationship.deleteMany({
        where: { methodology: KG_TAG },
      }),
      this.prisma.carSimilarityScore.deleteMany({
        where: { methodology: KG_TAG },
      }),
    ]);

    const segN = await this.recomputeSegmentGraph(since);
    const carN = await this.recomputeCarPriceAndStaticGraph(since, maxC);
    const simN = await this.recomputeSimilarityScores(maxC);
    this.logger.log(
      `Knowledge graph: segments=${segN}, carEdges=${carN}, similarity=${simN}`,
    );
    return {
      segmentEdges: segN,
      carEdges: carN,
      similarityRows: simN,
    };
  }

  private async recomputeSegmentGraph(since: Date): Promise<number> {
    const rows = await this.prisma.segmentMarketIndex.findMany({
      where: { snapshotDate: { gte: since } },
      orderBy: [{ segment: 'asc' }, { snapshotDate: 'asc' }],
    });
    const bySeg = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = bySeg.get(r.segment) ?? [];
      arr.push(r);
      bySeg.set(r.segment, arr);
    }
    const segs = [...bySeg.keys()];
    const batch: Array<{
      segment: string;
      relatedSegment: string;
      relationType: SegmentGraphRelationType;
      correlation: number;
      methodology: string;
    }> = [];

    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const sa = bySeg.get(segs[i]!)!;
        const sb = bySeg.get(segs[j]!)!;
        const z = alignedIndexReturns(sa, sb);
        if (!z) continue;
        const r = pearsonCorrelation(z.ra, z.rb);
        if (r == null || Math.abs(r) < 0.18) continue;
        batch.push({
          segment: segs[i]!,
          relatedSegment: segs[j]!,
          relationType: SegmentGraphRelationType.INDEX_CORRELATED,
          correlation: r,
          methodology: KG_TAG,
        });
        batch.push({
          segment: segs[j]!,
          relatedSegment: segs[i]!,
          relationType: SegmentGraphRelationType.INDEX_CORRELATED,
          correlation: r,
          methodology: KG_TAG,
        });
        const ma =
          z.ra.reduce((a, b) => a + b, 0) / Math.max(1, z.ra.length);
        const mb =
          z.rb.reduce((a, b) => a + b, 0) / Math.max(1, z.rb.length);
        if (Math.sign(ma) === Math.sign(mb) && Math.abs(ma + mb) > 0.02) {
          batch.push({
            segment: segs[i]!,
            relatedSegment: segs[j]!,
            relationType: SegmentGraphRelationType.MOMENTUM_ALIGNED,
            correlation: Math.sign(r) * (Math.abs(ma) + Math.abs(mb)) / 2,
            methodology: KG_TAG,
          });
          batch.push({
            segment: segs[j]!,
            relatedSegment: segs[i]!,
            relationType: SegmentGraphRelationType.MOMENTUM_ALIGNED,
            correlation: Math.sign(r) * (Math.abs(ma) + Math.abs(mb)) / 2,
            methodology: KG_TAG,
          });
        }
      }
    }

    for (let k = 0; k < batch.length; k += 400) {
      await this.prisma.segmentRelationship.createMany({
        data: batch.slice(k, k + 400),
        skipDuplicates: true,
      });
    }
    return batch.length;
  }

  private async recomputeCarPriceAndStaticGraph(
    since: Date,
    maxCarsPerSegment: number,
  ): Promise<number> {
    const cars = await this.prisma.car.findMany({
      where: { segment: { not: null } },
      include: { marketData: true, scores: true, specs: true },
    });
    const bySeg = new Map<string, typeof cars>();
    for (const c of cars) {
      const s = c.segment ?? '';
      if (!s) continue;
      const arr = bySeg.get(s) ?? [];
      arr.push(c);
      bySeg.set(s, arr);
    }

    const prisma = this.prisma;
    const histCache = new Map<string, Map<number, number>>();
    const loadMap = async (carId: string): Promise<Map<number, number>> => {
      if (histCache.has(carId)) return histCache.get(carId)!;
      const rows = await prisma.priceHistory.findMany({
        where: { carId, date: { gte: since } },
        orderBy: { date: 'asc' },
      });
      const m = priceRowsToDayMap(rows);
      histCache.set(carId, m);
      return m;
    };

    const edges: Array<{
      carId: string;
      relatedCarId: string;
      relationType: CarGraphRelationType;
      strength: number;
      methodology: string;
    }> = [];

    for (const [, list] of bySeg) {
      list.sort(
        (a, b) =>
          (b.marketData?.adsCount ?? 0) - (a.marketData?.adsCount ?? 0),
      );
      const slice = list.slice(0, maxCarsPerSegment);
      for (let i = 0; i < slice.length; i++) {
        for (let j = i + 1; j < slice.length; j++) {
          const a = slice[i]!;
          const b = slice[j]!;
          edges.push({
            carId: a.id,
            relatedCarId: b.id,
            relationType: CarGraphRelationType.SAME_SEGMENT,
            strength: 0.28,
            methodology: KG_TAG,
          });
          edges.push({
            carId: b.id,
            relatedCarId: a.id,
            relationType: CarGraphRelationType.SAME_SEGMENT,
            strength: 0.28,
            methodology: KG_TAG,
          });

          const ma = await loadMap(a.id);
          const mb = await loadMap(b.id);
          const pr = pearsonFromMaps(ma, mb);
          if (pr != null && Math.abs(pr) >= 0.32) {
            const s = Math.min(1, Math.abs(pr));
            edges.push({
              carId: a.id,
              relatedCarId: b.id,
              relationType: CarGraphRelationType.PRICE_CORRELATED,
              strength: s,
              methodology: KG_TAG,
            });
            edges.push({
              carId: b.id,
              relatedCarId: a.id,
              relationType: CarGraphRelationType.PRICE_CORRELATED,
              strength: s,
              methodology: KG_TAG,
            });
          }

          const pa = Number(a.marketData?.avgPrice ?? 0);
          const pb = Number(b.marketData?.avgPrice ?? 0);
          let rel = 1;
          if (pa > 0 && pb > 0) {
            rel = Math.abs(pa - pb) / ((pa + pb) / 2);
            if (rel < 0.22) {
              const st = Math.max(0.35, 1 - rel / 0.22);
              edges.push({
                carId: a.id,
                relatedCarId: b.id,
                relationType: CarGraphRelationType.COMPETITOR,
                strength: st,
                methodology: KG_TAG,
              });
              edges.push({
                carId: b.id,
                relatedCarId: a.id,
                relationType: CarGraphRelationType.COMPETITOR,
                strength: st,
                methodology: KG_TAG,
              });
            }
          }

          const ra = a.scores?.riskScore ?? 50;
          const rb = b.scores?.riskScore ?? 50;
          const rs = 1 - Math.min(1, Math.abs(ra - rb) / 100);
          if (rs > 0.72) {
            edges.push({
              carId: a.id,
              relatedCarId: b.id,
              relationType: CarGraphRelationType.RISK_CORRELATED,
              strength: rs * 0.85,
              methodology: KG_TAG,
            });
            edges.push({
              carId: b.id,
              relatedCarId: a.id,
              relationType: CarGraphRelationType.RISK_CORRELATED,
              strength: rs * 0.85,
              methodology: KG_TAG,
            });
          }

          const maM = Number(a.marketData?.priceChange7d ?? 0);
          const mbM = Number(b.marketData?.priceChange7d ?? 0);
          if (Number.isFinite(maM) && Number.isFinite(mbM)) {
            const ms = 1 - Math.min(1, Math.abs(maM - mbM) / 0.08);
            if (ms > 0.55) {
              edges.push({
                carId: a.id,
                relatedCarId: b.id,
                relationType: CarGraphRelationType.MOMENTUM_CORRELATED,
                strength: ms * 0.9,
                methodology: KG_TAG,
              });
              edges.push({
                carId: b.id,
                relatedCarId: a.id,
                relationType: CarGraphRelationType.MOMENTUM_CORRELATED,
                strength: ms * 0.9,
                methodology: KG_TAG,
              });
            }
          }

          const la = a.marketData?.liquidityScore ?? 50;
          const lb = b.marketData?.liquidityScore ?? 50;
          const ls = 1 - Math.min(1, Math.abs(la - lb) / 100);
          if (ls > 0.78) {
            edges.push({
              carId: a.id,
              relatedCarId: b.id,
              relationType: CarGraphRelationType.LIQUIDITY_CORRELATED,
              strength: ls * 0.8,
              methodology: KG_TAG,
            });
            edges.push({
              carId: b.id,
              relatedCarId: a.id,
              relationType: CarGraphRelationType.LIQUIDITY_CORRELATED,
              strength: ls * 0.8,
              methodology: KG_TAG,
            });
          }

          if (
            pr != null &&
            Math.abs(pr) >= 0.45 &&
            pa > 0 &&
            pb > 0 &&
            rel < 0.25
          ) {
            const sub = Math.min(
              1,
              Math.abs(pr) * 0.55 + (1 - rel / 0.25) * 0.45,
            );
            edges.push({
              carId: a.id,
              relatedCarId: b.id,
              relationType: CarGraphRelationType.SUBSTITUTE,
              strength: sub,
              methodology: KG_TAG,
            });
            edges.push({
              carId: b.id,
              relatedCarId: a.id,
              relationType: CarGraphRelationType.SUBSTITUTE,
              strength: sub,
              methodology: KG_TAG,
            });
          }

          if (
            a.brand === b.brand &&
            a.model.split(/\s+/)[0] === b.model.split(/\s+/)[0] &&
            b.year >= a.year &&
            (b.year > a.year || (pa > 0 && pb > pa * 1.06))
          ) {
            edges.push({
              carId: a.id,
              relatedCarId: b.id,
              relationType: CarGraphRelationType.UPGRADE_PATH,
              strength: 0.62,
              methodology: KG_TAG,
            });
          }
        }
      }
    }

    for (let k = 0; k < edges.length; k += 500) {
      await this.prisma.carRelationship.createMany({
        data: edges.slice(k, k + 500),
        skipDuplicates: true,
      });
    }
    return edges.length;
  }

  private async recomputeSimilarityScores(
    maxCarsPerSegment: number,
  ): Promise<number> {
    const cars = await this.prisma.car.findMany({
      where: { segment: { not: null } },
      include: { marketData: true, scores: true, specs: true, ownershipCost: true },
    });
    const bySeg = new Map<string, typeof cars>();
    for (const c of cars) {
      const s = c.segment ?? '';
      if (!s) continue;
      const arr = bySeg.get(s) ?? [];
      arr.push(c);
      bySeg.set(s, arr);
    }
    let n = 0;
    for (const [, list] of bySeg) {
      list.sort(
        (a, b) =>
          (b.scores?.investmentScore ?? 0) - (a.scores?.investmentScore ?? 0),
      );
      const slice = list.slice(0, maxCarsPerSegment);
      const rows: Array<{
        carId: string;
        peerCarId: string;
        score: number;
        specSim: number;
        priceSim: number;
        corrSim: number | null;
        ownershipSim: number | null;
        methodology: string;
      }> = [];

      for (let i = 0; i < slice.length; i++) {
        for (let j = i + 1; j < slice.length; j++) {
          const a = slice[i]!;
          const b = slice[j]!;
          const sp = specSimilarity(a.specs, b.specs);
          const pa = Number(a.marketData?.avgPrice ?? 0);
          const pb = Number(b.marketData?.avgPrice ?? 0);
          const pz =
            pa > 0 && pb > 0 ? priceBandSimilarity(pa, pb) : 0.4;
          const pr = await this.prisma.carRelationship.findFirst({
            where: {
              carId: a.id,
              relatedCarId: b.id,
              relationType: CarGraphRelationType.PRICE_CORRELATED,
              methodology: KG_TAG,
            },
            select: { strength: true },
          });
          const corrSim = pr?.strength ?? null;
          let own: number | null = null;
          if (a.ownershipCost && b.ownershipCost) {
            const fa = Number(a.ownershipCost.fuelMonthlyTomans ?? 0);
            const fb = Number(b.ownershipCost.fuelMonthlyTomans ?? 0);
            if (fa > 0 && fb > 0)
              own = 1 - Math.min(1, Math.abs(fa - fb) / ((fa + fb) / 2));
          }
          const score = Math.min(
            1,
            0.28 * sp +
              0.3 * pz +
              0.28 * (corrSim ?? 0.25) +
              0.14 * (own ?? 0.35),
          );
          rows.push({
            carId: a.id,
            peerCarId: b.id,
            score,
            specSim: sp,
            priceSim: pz,
            corrSim,
            ownershipSim: own,
            methodology: KG_TAG,
          });
          rows.push({
            carId: b.id,
            peerCarId: a.id,
            score,
            specSim: sp,
            priceSim: pz,
            corrSim,
            ownershipSim: own,
            methodology: KG_TAG,
          });
        }
      }
      const similarEdges: Array<{
        carId: string;
        relatedCarId: string;
        relationType: CarGraphRelationType;
        strength: number;
        methodology: string;
      }> = [];
      for (let k = 0; k < rows.length; k += 400) {
        const chunk = rows.slice(k, k + 400);
        await this.prisma.carSimilarityScore.createMany({
          data: chunk,
          skipDuplicates: true,
        });
        n += chunk.length;
        for (const row of chunk) {
          if (row.score >= 0.58) {
            similarEdges.push({
              carId: row.carId,
              relatedCarId: row.peerCarId,
              relationType: CarGraphRelationType.SIMILAR,
              strength: row.score,
              methodology: KG_TAG,
            });
          }
        }
      }
      for (let k = 0; k < similarEdges.length; k += 500) {
        await this.prisma.carRelationship.createMany({
          data: similarEdges.slice(k, k + 500),
          skipDuplicates: true,
        });
      }
    }
    return n;
  }

  async graphStats() {
    const [byCarRel, bySegRel, simCount] = await Promise.all([
      this.prisma.carRelationship.groupBy({
        by: ['relationType'],
        _count: { id: true },
        where: { methodology: KG_TAG },
      }),
      this.prisma.segmentRelationship.groupBy({
        by: ['relationType'],
        _count: { id: true },
        where: { methodology: KG_TAG },
      }),
      this.prisma.carSimilarityScore.count({
        where: { methodology: KG_TAG },
      }),
    ]);
    return {
      methodology: KG_TAG,
      carRelationships: byCarRel.map((r) => ({
        type: r.relationType,
        count: r._count.id,
      })),
      segmentRelationships: bySegRel.map((r) => ({
        type: r.relationType,
        count: r._count.id,
      })),
      similarityPairs: simCount,
    };
  }
}
