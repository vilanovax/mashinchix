import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { MarketScenario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  gaussian,
  metricsFromPath,
  quantileSorted,
  segmentExtraDriftPct,
} from './scenario-math.util';

export type PortfolioInput = {
  carIds: string[];
  weights: number[];
};

export type ScenarioRunResult = {
  scenarioId: string;
  scenarioName: string;
  paths: number;
  durationDays: number;
  finalReturn: {
    mean: number;
    median: number;
    worstCase: number;
    bestCase: number;
  };
  maxDrawdown: { mean: number; p95: number };
  volatility: number;
  survivalProbability: number;
  lossProbability: number;
  timeToRecovery: { medianDays: number | null; meanDays: number | null };
  riskScoresAdjusted: Array<{
    carId: string;
    baseRisk: number;
    stressedRisk: number;
  }>;
};

@Injectable()
export class ScenarioSimulationService {
  constructor(private readonly prisma: PrismaService) {}

  async runScenario(
    portfolio: PortfolioInput,
    scenarioOrId: MarketScenario | string,
    options?: { paths?: number },
  ): Promise<ScenarioRunResult> {
    const scenario =
      typeof scenarioOrId === 'string'
        ? await this.prisma.marketScenario.findUnique({
            where: { id: scenarioOrId },
          })
        : scenarioOrId;
    if (!scenario) throw new NotFoundException('سناریو یافت نشد');

    const nPath = Math.min(Math.max(options?.paths ?? 400, 50), 2000);
    const { carIds, weights } = portfolio;
    if (carIds.length !== weights.length || !carIds.length) {
      throw new BadRequestException('پورتفوی نامعتبر است');
    }
    const s = weights.reduce((a, b) => a + b, 0);
    const w = Math.abs(s - 1) > 1e-4 ? weights.map((x) => x / s) : weights;

    const cars = await this.prisma.car.findMany({
      where: { id: { in: carIds } },
      include: { marketData: true, scores: true },
    });
    const byId = new Map(cars.map((c) => [c.id, c]));

    const dailySigma: number[] = [];
    const driftAdj: number[] = [];
    const baseRisk: number[] = [];

    for (let i = 0; i < carIds.length; i++) {
      const c = byId.get(carIds[i]);
      const md = c?.marketData;
      const raw = md?.volatilityRaw != null ? Number(md.volatilityRaw) : null;
      const vs = md?.volatilityScore ?? 50;
      const ann = raw != null && raw > 0 ? raw : 0.15 + (vs / 100) * 0.25;
      const dailyBase = ann / Math.sqrt(252);
      dailySigma.push(dailyBase * scenario.volatilityMultiplier);

      const extra = segmentExtraDriftPct(
        c?.segment ?? null,
        scenario.segmentOverrides,
      );
      const totalPct = scenario.priceChangePct + extra;
      const muDay = totalPct / 100 / Math.max(1, scenario.durationDays);
      const demandDrag =
        ((1 - scenario.demandMultiplier) * 0.15) /
        Math.max(1, scenario.durationDays);
      const liqDrag =
        ((1 - scenario.liquidityMultiplier) * 0.12) /
        Math.max(1, scenario.durationDays);
      driftAdj.push(muDay - demandDrag - liqDrag);

      const rk = c?.scores?.riskScore ?? 50;
      baseRisk.push(rk);
    }

    const fin: number[] = [];
    const mdds: number[] = [];
    const recDays: number[] = [];
    const vols: number[] = [];

    for (let p = 0; p < nPath; p++) {
      let value = 1;
      const path: number[] = [value];
      for (let t = 1; t <= scenario.durationDays; t++) {
        let r = 0;
        for (let i = 0; i < carIds.length; i++) {
          const idio = gaussian() * dailySigma[i];
          r += w[i] * (driftAdj[i] + idio);
        }
        const liqNoise =
          (1 - scenario.liquidityMultiplier) * 0.00015 * gaussian();
        value *= 1 + r + liqNoise;
        value = Math.max(1e-6, value);
        path.push(value);
      }
      const m = metricsFromPath(path);
      fin.push(m.finalReturn);
      mdds.push(m.maxDrawdown);
      if (m.recoveryDays != null) recDays.push(m.recoveryDays);

      const rets: number[] = [];
      for (let j = 1; j < path.length; j++) {
        if (path[j - 1] > 0) rets.push(path[j] / path[j - 1] - 1);
      }
      if (rets.length > 1) {
        const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
        const v =
          rets.reduce((a, b) => a + (b - mean) ** 2, 0) /
          Math.max(1, rets.length - 1);
        vols.push(Math.sqrt(v) * Math.sqrt(252));
      }
    }

    fin.sort((a, b) => a - b);
    mdds.sort((a, b) => a - b);

    const survival =
      fin.filter((x) => x > -0.15).length / Math.max(1, nPath);
    const lossProb = fin.filter((x) => x < 0).length / Math.max(1, nPath);

    const ddP75 = quantileSorted(mdds, 0.75);
    const stressedRisk = baseRisk.map((br, i) => {
      const bump = Math.min(35, ddP75 * 80 + dailySigma[i] * 400);
      return Math.min(100, br + bump * (2 - w[i]));
    });

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      paths: nPath,
      durationDays: scenario.durationDays,
      finalReturn: {
        mean: fin.reduce((a, b) => a + b, 0) / fin.length,
        median: quantileSorted(fin, 0.5),
        worstCase: quantileSorted(fin, 0.05),
        bestCase: quantileSorted(fin, 0.95),
      },
      maxDrawdown: {
        mean: mdds.reduce((a, b) => a + b, 0) / mdds.length,
        p95: quantileSorted(mdds, 0.95),
      },
      volatility:
        vols.length > 0
          ? vols.reduce((a, b) => a + b, 0) / vols.length
          : 0,
      survivalProbability: survival,
      lossProbability: lossProb,
      timeToRecovery: {
        medianDays:
          recDays.length > 0
            ? quantileSorted([...recDays].sort((a, b) => a - b), 0.5)
            : null,
        meanDays:
          recDays.length > 0
            ? recDays.reduce((a, b) => a + b, 0) / recDays.length
            : null,
      },
      riskScoresAdjusted: carIds.map((id, i) => ({
        carId: id,
        baseRisk: baseRisk[i],
        stressedRisk: stressedRisk[i],
      })),
    };
  }
}
