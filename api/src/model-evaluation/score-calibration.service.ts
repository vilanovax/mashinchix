import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { mean, pearsonCorrelation } from './eval-math.util';

function clampWeightDelta(r: number | null): number {
  if (r == null || !Number.isFinite(r)) return 1;
  const adj = 1 + Math.max(-0.2, Math.min(0.2, r));
  return Math.max(0.75, Math.min(1.25, adj));
}

@Injectable()
export class ScoreCalibrationService {
  private readonly logger = new Logger(ScoreCalibrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * پیشنهاد وزن‌ها بر اساس همبستگی اخیر (ذخیره در ScoreCalibration؛ اعمال خودکار روی موتور امتیاز در این فاز نمی‌شود).
   */
  async runCalibration(): Promise<{ records: number }> {
    const invRows = await this.prisma.investmentScoreEvaluation.findMany({
      where: { return30d: { not: null } },
      take: 8000,
      orderBy: { createdAt: 'desc' },
    });
    const riskRows = await this.prisma.riskScoreEvaluation.findMany({
      where: {
        futureVolatility: { not: null },
        futureDrawdown: { not: null },
      },
      take: 8000,
      orderBy: { createdAt: 'desc' },
    });

    const records: Array<{
      modelName: string;
      parameter: string;
      oldWeight: number;
      newWeight: number;
      methodology: string;
    }> = [];

    if (invRows.length >= 30) {
      const xs = invRows.map((r) => r.investmentScore);
      const ys = invRows.map((r) => r.return30d!);
      const r = pearsonCorrelation(xs, ys);
      const nw = clampWeightDelta(r);
      records.push({
        modelName: 'recommendation-v3',
        parameter: 'weight.investmentScore',
        oldWeight: 1,
        newWeight: nw,
        methodology: `pearson(investmentScore,return30d)=${r?.toFixed(4) ?? 'n/a'}; n=${invRows.length}`,
      });
    }

    if (riskRows.length >= 30) {
      const xs = riskRows.map((r) => r.riskScore);
      const yv = riskRows.map((r) => r.futureVolatility!);
      const yd = riskRows.map((r) => r.futureDrawdown!);
      const rVol = pearsonCorrelation(xs, yv);
      const rDd = pearsonCorrelation(xs, yd);
      const nw = clampWeightDelta(rVol ?? rDd);
      records.push({
        modelName: 'recommendation-v3',
        parameter: 'weight.riskScore',
        oldWeight: 1,
        newWeight: nw,
        methodology: `pearson(risk,futVol)=${rVol?.toFixed(4) ?? 'n/a'}; pearson(risk,futDd)=${rDd?.toFixed(4) ?? 'n/a'}; n=${riskRows.length}`,
      });
    }

    const predRows = await this.prisma.predictionEvaluation.findMany({
      where: { pctError: { not: null } },
      take: 5000,
    });
    if (predRows.length >= 30) {
      const mape = mean(predRows.map((p) => Math.abs(p.pctError ?? 0)));
      const quality = Math.max(0.85, Math.min(1.1, 1 - mape));
      records.push({
        modelName: 'price-prediction',
        parameter: 'weight.predictedChangeInRecommendation',
        oldWeight: 1,
        newWeight: quality,
        methodology: `mape≈${(mape * 100).toFixed(2)}% (|pctError|); n=${predRows.length}`,
      });
    }

    for (const rec of records) {
      await this.prisma.scoreCalibration.create({ data: rec });
    }

    this.logger.log(`ScoreCalibration rows: ${records.length}`);
    return { records: records.length };
  }
}
