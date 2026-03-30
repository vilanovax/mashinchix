import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { mean } from './eval-math.util';

function rmse(errors: number[]): number {
  if (!errors.length) return 0;
  return Math.sqrt(mean(errors.map((e) => e * e)));
}

@Injectable()
export class ModelAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async predictionPerformance() {
    const rows = await this.prisma.predictionEvaluation.findMany({
      where: { actualPrice: { not: null }, error: { not: null } },
    });
    const byVersion = new Map<
      string,
      { abs: number[]; pct: number[]; err: number[]; horizon: number[] }
    >();
    for (const r of rows) {
      const g =
        byVersion.get(r.modelVersion) ?? {
          abs: [],
          pct: [],
          err: [],
          horizon: [],
        };
      if (r.absError != null) g.abs.push(r.absError);
      if (r.pctError != null) g.pct.push(Math.abs(r.pctError));
      if (r.error != null) g.err.push(r.error);
      g.horizon.push(r.horizonDays);
      byVersion.set(r.modelVersion, g);
    }
    return {
      totalRows: rows.length,
      byModelVersion: Array.from(byVersion.entries()).map(([v, g]) => ({
        modelVersion: v,
        count: g.abs.length,
        mae: g.abs.length ? mean(g.abs) : null,
        mape: g.pct.length ? mean(g.pct) * 100 : null,
        rmse: g.err.length ? rmse(g.err) : null,
        horizonDaysAvg: g.horizon.length ? mean(g.horizon) : null,
      })),
    };
  }

  async investmentPerformance() {
    const rows = await this.prisma.investmentScoreEvaluation.findMany({
      where: { return30d: { not: null } },
      take: 10000,
    });
    if (rows.length < 10) {
      return { sampleSize: rows.length, deciles: [], note: 'نمونه کم است' };
    }
    const sorted = [...rows].sort(
      (a, b) => a.investmentScore - b.investmentScore,
    );
    const n = sorted.length;
    const deciles: Array<{
      decile: number;
      avgReturn30d: number;
      avgScore: number;
      count: number;
    }> = [];
    for (let d = 0; d < 10; d++) {
      const lo = Math.floor((d * n) / 10);
      const hi = Math.floor(((d + 1) * n) / 10);
      const slice = sorted.slice(lo, hi);
      if (!slice.length) continue;
      deciles.push({
        decile: d + 1,
        avgReturn30d: mean(slice.map((s) => s.return30d!)),
        avgScore: mean(slice.map((s) => s.investmentScore)),
        count: slice.length,
      });
    }
    return { sampleSize: rows.length, deciles };
  }

  async riskPerformance() {
    const rows = await this.prisma.riskScoreEvaluation.findMany({
      where: {
        futureVolatility: { not: null },
        futureDrawdown: { not: null },
      },
      take: 10000,
    });
    const xs = rows.map((r) => r.riskScore);
    const vol = rows.map((r) => r.futureVolatility!);
    const dd = rows.map((r) => r.futureDrawdown!);
    const mRank = (a: number[], b: number[]) => {
      let conc = 0;
      let disc = 0;
      for (let i = 0; i < a.length; i++) {
        for (let j = i + 1; j < a.length; j++) {
          const sa = a[i] - a[j];
          const sb = b[i] - b[j];
          if (sa * sb > 0) conc++;
          if (sa * sb < 0) disc++;
        }
      }
      const tot = conc + disc;
      return tot ? (conc - disc) / tot : 0;
    };
    return {
      sampleSize: rows.length,
      meanRisk: xs.length ? mean(xs) : null,
      meanFutureVol: vol.length ? mean(vol) : null,
      meanFutureDd: dd.length ? mean(dd) : null,
      rankConcordanceRiskVol:
        xs.length >= 10 ? mRank(xs, vol) : null,
      rankConcordanceRiskDd:
        xs.length >= 10 ? mRank(xs, dd) : null,
    };
  }

  async recommendationPerformance() {
    const rows = await this.prisma.recommendationPerformance.findMany({
      take: 5000,
    });
    const with30 = rows.filter((r) => r.avgReturn30d != null);
    return {
      count: rows.length,
      avgReturn7d: mean(
        rows
          .filter((r) => r.avgReturn7d != null)
          .map((r) => r.avgReturn7d!),
      ),
      avgReturn30d: with30.length
        ? mean(with30.map((r) => r.avgReturn30d!))
        : null,
      avgReturn90d: mean(
        rows
          .filter((r) => r.avgReturn90d != null)
          .map((r) => r.avgReturn90d!),
      ),
      clickRate: rows.length
        ? rows.filter((r) => r.clicked).length / rows.length
        : 0,
      saveRate: rows.length
        ? rows.filter((r) => r.saved).length / rows.length
        : 0,
      dismissRate: rows.length
        ? rows.filter((r) => r.dismissed).length / rows.length
        : 0,
    };
  }

  async versionComparison() {
    const pred = await this.predictionPerformance();
    const inv = await this.investmentPerformance();
    const rec = await this.recommendationSessionModelVersions();
    return {
      prediction: pred.byModelVersion,
      investmentDeciles: inv.deciles?.length ?? 0,
      recommendationSessionsByModel: rec,
      scoreCalibrationLatest: await this.prisma.scoreCalibration.findMany({
        orderBy: { createdAt: 'desc' },
        take: 24,
      }),
    };
  }

  private async recommendationSessionModelVersions() {
    const raw = await this.prisma.recommendationSession.groupBy({
      by: ['modelVersion'],
      _count: { id: true },
    });
    return raw.map((r) => ({
      modelVersion: r.modelVersion,
      sessions: r._count.id,
    }));
  }
}
