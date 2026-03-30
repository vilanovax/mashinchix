import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CarGraphRelationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { simulateBuyAndHoldWeighted } from './custom-portfolio-sim.util';
import {
  analyticMaxDrawdownApprox,
  diversificationScore,
  dot,
  effectiveN,
  portfolioVariance,
  portfolioVol,
  projectWeightsToCaps,
  randomSimplexWeights,
  riskContributions,
} from './opt/portfolio-opt-math.util';
import type { OptimizationMethodology } from './dto/portfolio-optimize.dto';

const KG = 'kg-v1';

export type OptimAsset = {
  carId: string;
  segment: string;
  mu: number;
  sigma: number;
  liquidity: number;
};

export type OptimizationOutput = {
  methodology: OptimizationMethodology;
  carIds: string[];
  weights: number[];
  weightMap: Record<string, number>;
  expectedReturn: number;
  expectedVolatility: number;
  sharpeRatio: number | null;
  maxDrawdown: number | null;
  diversificationScore: number;
  effectiveN: number;
  riskContribution: Array<{ carId: string; share: number }>;
  constraintsSnapshot: Record<string, unknown>;
};

@Injectable()
export class PortfolioOptimizationService {
  private readonly logger = new Logger(PortfolioOptimizationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async optimize(input: {
    carIds?: string[];
    budget: number;
    methodology: OptimizationMethodology;
    maxWeightPerCar?: number;
    maxWeightPerSegment?: number;
    minLiquidity?: number;
    maxPortfolioVolatility?: number;
    riskTolerance?: 'LOW' | 'MEDIUM' | 'HIGH';
    mcSamples?: number;
    useHistoricalMaxDrawdown?: boolean;
    persist?: boolean;
  }): Promise<OptimizationOutput & { savedId?: string | null }> {
    const maxCar =
      input.maxWeightPerCar ??
      (input.riskTolerance === 'LOW' ? 0.28 : input.riskTolerance === 'HIGH' ? 0.42 : 0.35);
    const maxSeg = input.maxWeightPerSegment ?? 0.62;
    const minLiq = input.minLiquidity ?? 18;
    const samples = Math.min(Math.max(input.mcSamples ?? 220, 40), 800);

    const assets = await this.loadUniverse({
      carIds: input.carIds,
      budget: input.budget,
      minLiquidity: minLiq,
      maxAssets: 14,
    });
    if (assets.length < 2) {
      throw new BadRequestException(
        'حداقل دو خودرو با دادهٔ کافی برای بهینه‌سازی لازم است',
      );
    }

    const carIds = assets.map((a) => a.carId);
    const mu = assets.map((a) => a.mu);
    const sigma = assets.map((a) => Math.max(0.04, a.sigma));
    const segments = assets.map((a) => a.segment || '_');
    const corr = await this.buildCorrelationMatrix(carIds, segments);

    let muUse = [...mu];
    if (input.methodology === 'ROBUST') {
      const shock = input.riskTolerance === 'LOW' ? 0.22 : 0.12;
      muUse = mu.map((m) => m * (1 - shock));
    }

    let w: number[];
    switch (input.methodology) {
      case 'RISK_PARITY':
        w = this.riskParityWeights(sigma);
        break;
      case 'ERC':
        w = this.ercWeights(sigma, corr, segments, maxCar, maxSeg);
        break;
      case 'MIN_VOLATILITY':
        w = this.mcMinVol(sigma, corr, segments, maxCar, maxSeg, samples);
        break;
      case 'MAX_RETURN':
        w = this.maxReturnWeights(muUse, segments, maxCar, maxSeg);
        break;
      case 'KELLY':
        w = this.kellyWeights(muUse, sigma, segments, maxCar, maxSeg);
        break;
      case 'SEGMENT_BALANCED':
        w = this.segmentBalanced(segments, maxCar, maxSeg);
        break;
      case 'MAX_SHARPE':
      case 'ROBUST':
      default:
        w = this.mcMaxSharpe(muUse, sigma, corr, segments, maxCar, maxSeg, samples);
        break;
    }

    w = projectWeightsToCaps(w, segments, maxCar, maxSeg);
    let expRet = dot(w, muUse);
    let expVol = portfolioVol(w, sigma, corr);
    if (
      input.maxPortfolioVolatility != null &&
      input.maxPortfolioVolatility > 0 &&
      expVol > input.maxPortfolioVolatility
    ) {
      const scale = input.maxPortfolioVolatility / Math.max(expVol, 1e-6);
      w = w.map((x) => x * scale);
      const s = w.reduce((a, b) => a + b, 0);
      if (s > 1e-8) w = w.map((x) => x / s);
      w = projectWeightsToCaps(w, segments, maxCar, maxSeg);
      expRet = dot(w, muUse);
      expVol = portfolioVol(w, sigma, corr);
    }

    const sharpe = expVol > 1e-6 ? expRet / expVol : null;
    const div = diversificationScore(w);
    const en = effectiveN(w);
    const rcFull = riskContributions(w, sigma, corr);
    const riskContribution = carIds.map((id, i) => ({
      carId: id,
      share: rcFull[i] ?? 0,
    }));

    let maxDd: number | null = analyticMaxDrawdownApprox(expVol);
    if (input.useHistoricalMaxDrawdown) {
      const end = new Date();
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 365);
      const sim = await simulateBuyAndHoldWeighted(this.prisma, carIds, w, start, end);
      if (sim) maxDd = sim.maxDrawdown;
    }

    const out: OptimizationOutput = {
      methodology: input.methodology,
      carIds,
      weights: w,
      weightMap: Object.fromEntries(carIds.map((id, i) => [id, w[i]!])),
      expectedReturn: expRet,
      expectedVolatility: expVol,
      sharpeRatio: sharpe,
      maxDrawdown: maxDd,
      diversificationScore: div,
      effectiveN: en,
      riskContribution,
      constraintsSnapshot: {
        maxWeightPerCar: maxCar,
        maxWeightPerSegment: maxSeg,
        minLiquidity: minLiq,
        budget: input.budget,
        riskTolerance: input.riskTolerance ?? null,
        maxPortfolioVolatility: input.maxPortfolioVolatility ?? null,
      },
    };

    let savedId: string | null = null;
    if (input.persist) {
      const row = await this.prisma.portfolioOptimizationResult.create({
        data: {
          methodology: input.methodology,
          carIds,
          weights: out.weightMap as unknown as Prisma.InputJsonValue,
          expectedReturn: expRet,
          expectedVolatility: expVol,
          sharpeRatio: sharpe,
          maxDrawdown: maxDd,
          diversificationScore: div,
          riskContribution: riskContribution as unknown as Prisma.InputJsonValue,
          constraints: out.constraintsSnapshot as unknown as Prisma.InputJsonValue,
        },
      });
      savedId = row.id;
    }

    return { ...out, savedId };
  }

  async frontier(input: {
    carIds?: string[];
    budget: number;
    steps?: number;
    maxWeightPerCar?: number;
    maxWeightPerSegment?: number;
    minLiquidity?: number;
  }) {
    const steps = Math.min(Math.max(input.steps ?? 12, 5), 24);
    const base = await this.optimize({
      ...input,
      methodology: 'MIN_VOLATILITY',
      riskTolerance: 'MEDIUM',
      mcSamples: 160,
      persist: false,
    });
    const hi = await this.optimize({
      ...input,
      methodology: 'MAX_RETURN',
      riskTolerance: 'MEDIUM',
      persist: false,
    });
    const n = base.carIds.length;
    const wMin = base.weights;
    const wMaxAligned = base.carIds.map((id) => hi.weightMap[id] ?? 0);
    const sMax = wMaxAligned.reduce((a, b) => a + b, 0);
    const wMax = sMax > 1e-8 ? wMaxAligned.map((x) => x / sMax) : wMin;

    const points: Array<{
      t: number;
      expectedReturn: number;
      expectedVolatility: number;
      sharpe: number | null;
      weights: Record<string, number>;
    }> = [];

    const assets = await this.loadUniverse({
      carIds: base.carIds,
      budget: input.budget,
      minLiquidity: input.minLiquidity ?? 18,
      maxAssets: base.carIds.length,
    });
    if (assets.length !== base.carIds.length) {
      throw new BadRequestException('هم‌ترازی داده برای مرز کارآمد ممکن نشد');
    }
    const mu = assets.map((a) => a.mu);
    const sigma = assets.map((a) => Math.max(0.04, a.sigma));
    const segments = assets.map((a) => a.segment || '_');
    const corr = await this.buildCorrelationMatrix(base.carIds, segments);
    const maxCar = input.maxWeightPerCar ?? 0.35;
    const maxSeg = input.maxWeightPerSegment ?? 0.62;

    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      let w = wMin.map((v, i) => t * wMax[i]! + (1 - t) * v);
      const s = w.reduce((a, b) => a + b, 0);
      if (s > 1e-8) w = w.map((x) => x / s);
      w = projectWeightsToCaps(w, segments, maxCar, maxSeg);
      const er = dot(w, mu);
      const ev = portfolioVol(w, sigma, corr);
      points.push({
        t,
        expectedReturn: er,
        expectedVolatility: ev,
        sharpe: ev > 1e-6 ? er / ev : null,
        weights: Object.fromEntries(assets.map((a, i) => [a.carId, w[i]!])),
      });
    }
    return { carIds: base.carIds, points };
  }

  async bestBySharpe(input: {
    carIds?: string[];
    budget: number;
  }) {
    const methods: OptimizationMethodology[] = [
      'MAX_SHARPE',
      'MIN_VOLATILITY',
      'RISK_PARITY',
      'ERC',
      'KELLY',
      'SEGMENT_BALANCED',
      'ROBUST',
    ];
    const runs: OptimizationOutput[] = [];
    for (const m of methods) {
      try {
        const r = await this.optimize({ ...input, methodology: m, persist: false });
        runs.push(r);
      } catch (e) {
        this.logger.warn(`optimize ${m} failed: ${e}`);
      }
    }
    runs.sort(
      (a, b) => (b.sharpeRatio ?? -1e9) - (a.sharpeRatio ?? -1e9),
    );
    return { ranked: runs, winner: runs[0] ?? null };
  }

  async latestResults(limit = 20) {
    return this.prisma.portfolioOptimizationResult.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 80),
    });
  }

  private async loadUniverse(params: {
    carIds?: string[];
    budget: number;
    minLiquidity: number;
    maxAssets: number;
  }): Promise<OptimAsset[]> {
    const maxA = Math.min(Math.max(params.maxAssets, 2), 18);
    if (params.carIds?.length && params.carIds.length >= 2) {
      const ids = params.carIds.slice(0, maxA);
      const cars = await this.prisma.car.findMany({
        where: { id: { in: ids } },
        include: { marketData: true, pricePrediction: true },
      });
      const byId = new Map(cars.map((c) => [c.id, c]));
      const ordered = ids
        .map((id) => byId.get(id))
        .filter((c): c is NonNullable<typeof c> => c != null);
      return this.toAssets(ordered, params.budget, params.minLiquidity);
    }
    const cars = await this.prisma.car.findMany({
      where: {
        marketData: {
          is: {
            avgPrice: { lte: params.budget, gt: 0 },
            liquidityScore: { gte: params.minLiquidity },
          },
        },
        scores: { investmentScore: { not: null } },
      },
      include: { marketData: true, pricePrediction: true, scores: true },
      take: 120,
      orderBy: { scores: { investmentScore: 'desc' } },
    });
    const assets = this.toAssets(cars, params.budget, params.minLiquidity);
    return assets.slice(0, maxA);
  }

  private toAssets(
    cars: Array<{
      id: string;
      segment: string | null;
      marketData: { avgPrice: unknown; liquidityScore: number | null; volatilityRaw: unknown; volatilityScore: number | null } | null;
      pricePrediction: { predictedChange90d: unknown; predictedChange30d: unknown } | null;
    }>,
    budget: number,
    minLiq: number,
  ): OptimAsset[] {
    const out: OptimAsset[] = [];
    for (const c of cars) {
      const md = c.marketData;
      if (!md?.avgPrice) continue;
      const price = Number(md.avgPrice);
      if (!Number.isFinite(price) || price > budget * 1.02) continue;
      const liq = md.liquidityScore ?? 0;
      if (liq < minLiq) continue;
      const ch90 = c.pricePrediction?.predictedChange90d
        ? Number(c.pricePrediction.predictedChange90d)
        : c.pricePrediction?.predictedChange30d
          ? Number(c.pricePrediction.predictedChange30d) * 2.5
          : 0.06;
      const mu = Number.isFinite(ch90) ? ch90 * 1.15 : 0.07;
      const raw = md.volatilityRaw != null ? Number(md.volatilityRaw) : null;
      const vs = md.volatilityScore ?? 50;
      const sigma =
        raw != null && raw > 0
          ? Math.min(0.85, raw * 1.05)
          : 0.12 + (vs / 100) * 0.28;
      out.push({
        carId: c.id,
        segment: c.segment ?? '_',
        mu,
        sigma,
        liquidity: liq,
      });
    }
    return out;
  }

  private async buildCorrelationMatrix(
    carIds: string[],
    segments: string[],
  ): Promise<number[][]> {
    const n = carIds.length;
    const idx = new Map(carIds.map((id, i) => [id, i]));
    const rho: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1 : 0.12)),
    );

    const edges = await this.prisma.carRelationship.findMany({
      where: {
        methodology: KG,
        relationType: CarGraphRelationType.PRICE_CORRELATED,
        carId: { in: carIds },
        relatedCarId: { in: carIds },
      },
      select: { carId: true, relatedCarId: true, strength: true },
    });
    for (const e of edges) {
      const i = idx.get(e.carId);
      const j = idx.get(e.relatedCarId);
      if (i == null || j == null || i === j) continue;
      const r = Math.min(0.98, Math.max(-0.98, e.strength));
      rho[i]![j] = r;
      rho[j]![i] = r;
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (segments[i] === segments[j] && segments[i] && segments[i] !== '_') {
          const base = 0.22;
          if (Math.abs(rho[i]![j]!) < 0.15) {
            rho[i]![j] = base;
            rho[j]![i] = base;
          }
        }
      }
    }
    for (let i = 0; i < n; i++) rho[i]![i] = 1;
    return rho;
  }

  private riskParityWeights(sigma: number[]): number[] {
    const inv = sigma.map((s) => 1 / Math.max(s, 1e-3));
    const t = inv.reduce((a, b) => a + b, 0);
    return inv.map((x) => x / t);
  }

  private ercWeights(
    sigma: number[],
    corr: number[][],
    segments: string[],
    maxCar: number,
    maxSeg: number,
  ): number[] {
    let w = this.riskParityWeights(sigma);
    w = projectWeightsToCaps(w, segments, maxCar, maxSeg);
    for (let it = 0; it < 14; it++) {
      const rc = riskContributions(w, sigma, corr);
      const inv = rc.map((r) => 1 / Math.max(r, 1e-5));
      const s = inv.reduce((a, b) => a + b, 0);
      w = inv.map((x) => x / s);
      w = projectWeightsToCaps(w, segments, maxCar, maxSeg);
    }
    return w;
  }

  private mcMaxSharpe(
    mu: number[],
    sigma: number[],
    corr: number[][],
    segments: string[],
    maxCar: number,
    maxSeg: number,
    samples: number,
  ): number[] {
    let bestW = randomSimplexWeights(mu.length);
    let bestS = -1e9;
    for (let k = 0; k < samples; k++) {
      let w = randomSimplexWeights(mu.length);
      w = projectWeightsToCaps(w, segments, maxCar, maxSeg);
      const ev = portfolioVol(w, sigma, corr);
      const er = dot(w, mu);
      const s = ev > 1e-6 ? er / ev : -1e9;
      if (s > bestS) {
        bestS = s;
        bestW = w;
      }
    }
    return bestW;
  }

  private mcMinVol(
    sigma: number[],
    corr: number[][],
    segments: string[],
    maxCar: number,
    maxSeg: number,
    samples: number,
  ): number[] {
    let bestW = randomSimplexWeights(sigma.length);
    let bestV = Infinity;
    for (let k = 0; k < samples; k++) {
      let w = randomSimplexWeights(sigma.length);
      w = projectWeightsToCaps(w, segments, maxCar, maxSeg);
      const v = portfolioVariance(w, sigma, corr);
      if (v < bestV) {
        bestV = v;
        bestW = w;
      }
    }
    return bestW;
  }

  private maxReturnWeights(
    mu: number[],
    segments: string[],
    maxCar: number,
    maxSeg: number,
  ): number[] {
    const n = mu.length;
    const k = mu.indexOf(Math.max(...mu));
    const w = new Array(n).fill(0);
    w[k] = Math.min(maxCar, 1);
    let surplus = 1 - w[k]!;
    if (surplus > 1e-6) {
      const rest = mu.map((m, i) => (i === k ? 0 : Math.max(0.01, m)));
      const s = rest.reduce((a, b) => a + b, 0);
      for (let i = 0; i < n; i++) {
        if (i !== k) w[i] = surplus * (rest[i]! / s);
      }
    }
    return projectWeightsToCaps(w, segments, maxCar, maxSeg);
  }

  private kellyWeights(
    mu: number[],
    sigma: number[],
    segments: string[],
    maxCar: number,
    maxSeg: number,
  ): number[] {
    const w = mu.map((m, i) => {
      const s = Math.max(1e-3, sigma[i]!);
      const f = m > 0.02 ? m / (s * s) : 0;
      return Math.max(0, f);
    });
    const t = w.reduce((a, b) => a + b, 0);
    const x = t > 1e-8 ? w.map((v) => v / t) : w.map(() => 1 / w.length);
    return projectWeightsToCaps(x, segments, maxCar, maxSeg);
  }

  private segmentBalanced(
    segments: string[],
    maxCar: number,
    maxSeg: number,
  ): number[] {
    const bySeg = new Map<string, number[]>();
    segments.forEach((seg, i) => {
      const s = seg || '_';
      const arr = bySeg.get(s) ?? [];
      arr.push(i);
      bySeg.set(s, arr);
    });
    const n = segments.length;
    const w = new Array(n).fill(0);
    const g = bySeg.size || 1;
    const perSeg = 1 / g;
    for (const [, idxs] of bySeg) {
      const inner = perSeg / idxs.length;
      idxs.forEach((i) => {
        w[i] = inner;
      });
    }
    return projectWeightsToCaps(w, segments, maxCar, maxSeg);
  }
}
