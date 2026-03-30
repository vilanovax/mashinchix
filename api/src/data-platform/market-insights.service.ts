import { Injectable, Logger } from '@nestjs/common';
import {
  InsightType,
  MarketCycleType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';

const TOP_K = 20;

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function linearNorm(
  value: number,
  lo: number,
  hi: number,
  invert = false,
): number {
  if (hi <= lo) return 50;
  let t = (value - lo) / (hi - lo);
  if (invert) t = 1 - t;
  return clampScore(t * 100);
}

function carTitle(c: {
  brand: string;
  model: string;
  year: number;
}): string {
  return `${c.brand} ${c.model} ${c.year}`;
}

type CarRow = Prisma.CarGetPayload<{
  include: {
    marketData: true;
    scores: true;
    pricePrediction: true;
  };
}>;

@Injectable()
export class MarketInsightsService {
  private readonly logger = new Logger(MarketInsightsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateInsights(date?: Date): Promise<{ created: number }> {
    const snapshotDate = startOfUtcDay(date ?? new Date());

    await this.prisma.marketInsight.deleteMany({ where: { snapshotDate } });

    const cars = await this.prisma.car.findMany({
      include: {
        marketData: true,
        scores: true,
        pricePrediction: true,
      },
    });

    const liquidityLatest = await this.loadLatestLiquidityByCar();

    const segmentMedians = this.segmentMedianPrices(cars);

    const priceChanges30 = cars
      .map((c) => ({
        car: c,
        ch: toNumber(c.marketData?.priceChange30d),
      }))
      .filter((x) => x.ch != null) as Array<{
      car: CarRow;
      ch: number;
    }>;

    const chVals = priceChanges30.map((x) => x.ch);
    const chMin = chVals.length ? Math.min(...chVals) : 0;
    const chMax = chVals.length ? Math.max(...chVals) : 0;

    const rows: Prisma.MarketInsightCreateManyInput[] = [];

    const pushCarInsight = (
      insightType: InsightType,
      car: CarRow,
      title: string,
      description: string,
      score: number,
      metadata?: Prisma.InputJsonValue,
    ) => {
      rows.push({
        insightType,
        carId: car.id,
        segment: car.segment ?? undefined,
        title,
        description,
        score: clampScore(score),
        metadata: metadata ?? Prisma.JsonNull,
        snapshotDate,
      });
    };

    const pushSegmentInsight = (
      insightType: InsightType,
      segment: string,
      title: string,
      description: string,
      score: number,
      metadata?: Prisma.InputJsonValue,
    ) => {
      rows.push({
        insightType,
        segment,
        title,
        description,
        score: clampScore(score),
        metadata: metadata ?? Prisma.JsonNull,
        snapshotDate,
      });
    };

    // --- Fastest rising / falling price
    const rising = [...priceChanges30].sort((a, b) => b.ch - a.ch).slice(0, TOP_K);
    for (const x of rising) {
      pushCarInsight(
        InsightType.FASTEST_RISING_PRICE,
        x.car,
        `Strongest 30d price uptrend: ${carTitle(x.car)}`,
        `Approx. ${(x.ch * 100).toFixed(1)}% change vs prior window (market aggregate).`,
        linearNorm(x.ch, chMin, chMax),
        { priceChange30d: x.ch, momentumScore: x.car.marketData?.momentumScore },
      );
    }

    const falling = [...priceChanges30].sort((a, b) => a.ch - b.ch).slice(0, TOP_K);
    for (const x of falling) {
      pushCarInsight(
        InsightType.FASTEST_FALLING_PRICE,
        x.car,
        `Sharpest 30d price decline: ${carTitle(x.car)}`,
        `Approx. ${(x.ch * 100).toFixed(1)}% change vs prior window.`,
        linearNorm(x.ch, chMin, chMax, true),
        { priceChange30d: x.ch },
      );
    }

    // --- Momentum
    const momRows = cars
      .filter((c) => c.marketData?.momentumScore != null)
      .map((c) => ({ car: c, m: c.marketData!.momentumScore! }))
      .sort((a, b) => b.m - a.m)
      .slice(0, TOP_K);
    const momMax = momRows[0]?.m ?? 1;
    const momMin = momRows[momRows.length - 1]?.m ?? 0;
    for (const x of momRows) {
      pushCarInsight(
        InsightType.HIGH_MOMENTUM,
        x.car,
        `High price momentum: ${carTitle(x.car)}`,
        `Momentum score ${x.m.toFixed(1)} (from recent price trajectory).`,
        linearNorm(x.m, momMin, momMax),
        { momentumScore: x.m },
      );
    }

    // --- Volatility (low volatilityScore = more volatile in schema)
    const volRows = cars.filter(
      (c) =>
        c.marketData?.volatilityScore != null ||
        c.marketData?.volatilityRaw != null,
    );
    const volScores = volRows
      .map((c) => ({
        car: c,
        stability: c.marketData!.volatilityScore,
        raw: c.marketData!.volatilityRaw,
      }))
      .filter((x) => x.stability != null);
    const stabVals = volScores.map((x) => x.stability!);
    const stabMin = stabVals.length ? Math.min(...stabVals) : 0;
    const stabMax = stabVals.length ? Math.max(...stabVals) : 100;
    for (const x of [...volScores]
      .sort((a, b) => (a.stability ?? 0) - (b.stability ?? 0))
      .slice(0, TOP_K)) {
      pushCarInsight(
        InsightType.HIGH_VOLATILITY,
        x.car,
        `Elevated volatility: ${carTitle(x.car)}`,
        `Stability score ~${(x.stability ?? 0).toFixed(0)} (lower = choppier prices).`,
        linearNorm(x.stability ?? 0, stabMin, stabMax, true),
        {
          volatilityScore: x.stability,
          volatilityRaw: x.raw,
        },
      );
    }
    for (const x of [...volScores]
      .sort((a, b) => (b.stability ?? 0) - (a.stability ?? 0))
      .slice(0, TOP_K)) {
      pushCarInsight(
        InsightType.LOW_VOLATILITY,
        x.car,
        `Relatively stable pricing: ${carTitle(x.car)}`,
        `Stability score ~${(x.stability ?? 0).toFixed(0)}.`,
        linearNorm(x.stability ?? 0, stabMin, stabMax),
        { volatilityScore: x.stability },
      );
    }

    // --- Under / over valued vs segment median
    for (const c of cars) {
      const seg = c.segment?.trim();
      if (!seg) continue;
      const median = segmentMedians.get(seg);
      const avg = toNumber(c.marketData?.avgPrice);
      const overall = c.scores?.overallScore;
      if (median == null || avg == null || overall == null) continue;
      const ratio = avg / median;
      if (overall >= 68 && ratio <= 0.92) {
        pushCarInsight(
          InsightType.UNDERVALUED,
          c,
          `Possibly undervalued vs segment: ${carTitle(c)}`,
          `Strong overall score (${overall.toFixed(0)}) but listed ~${((1 - ratio) * 100).toFixed(0)}% below segment median price.`,
          clampScore(
            overall * 0.45 + Math.min(100, (1 - ratio) * 200),
          ),
          { segmentMedian: median, avgPrice: avg, overallScore: overall },
        );
      }
      if (overall <= 48 && ratio >= 1.1) {
        pushCarInsight(
          InsightType.OVERVALUED,
          c,
          `Possibly stretched vs segment: ${carTitle(c)}`,
          `Weaker overall score (${overall.toFixed(0)}) vs ~${((ratio - 1) * 100).toFixed(0)}% above segment median.`,
          clampScore(
            (100 - overall) * 0.35 + Math.min(100, (ratio - 1) * 180),
          ),
          { segmentMedian: median, avgPrice: avg, overallScore: overall },
        );
      }
    }

    // --- Demand vs supply (adsCount proxy for supply)
    const demandSupply = cars
      .filter(
        (c) =>
          c.marketData?.demandScore != null && c.marketData.adsCount != null,
      )
      .map((c) => ({
        car: c,
        d: c.marketData!.demandScore!,
        ads: c.marketData!.adsCount,
      }));
    const maxAds = Math.max(1, ...demandSupply.map((x) => x.ads));
    const minAds = Math.min(...demandSupply.map((x) => x.ads));
    const maxD = Math.max(1, ...demandSupply.map((x) => x.d));
    const minD = Math.min(...demandSupply.map((x) => x.d));
    for (const x of demandSupply) {
      if (x.d >= 60 && x.ads <= Math.max(2, minAds + (maxAds - minAds) * 0.2)) {
        pushCarInsight(
          InsightType.HIGH_DEMAND_LOW_SUPPLY,
          x.car,
          `Tight supply with firm demand: ${carTitle(x.car)}`,
          `Demand score ${x.d.toFixed(0)} with only ${x.ads} active listings (approx).`,
          clampScore(x.d * 0.55 + (1 - x.ads / maxAds) * 45),
          { demandScore: x.d, adsCount: x.ads },
        );
      }
      if (x.d <= 40 && x.ads >= minAds + (maxAds - minAds) * 0.55) {
        pushCarInsight(
          InsightType.HIGH_SUPPLY_LOW_DEMAND,
          x.car,
          `Heavy listings vs soft demand: ${carTitle(x.car)}`,
          `Demand score ${x.d.toFixed(0)} with ${x.ads} listings.`,
          clampScore((100 - x.d) * 0.45 + linearNorm(x.ads, minAds, maxAds, false) * 0.55),
          { demandScore: x.d, adsCount: x.ads },
        );
      }
    }

    // --- Liquidity: fastest / slowest selling
    const liqList = cars
      .map((c) => {
        const l = liquidityLatest.get(c.id);
        if (!l?.avgDaysToSell || l.avgDaysToSell <= 0) return null;
        return { car: c, days: l.avgDaysToSell };
      })
      .filter(Boolean) as Array<{ car: CarRow; days: number }>;
    const daysVals = liqList.map((x) => x.days);
    const dMin = daysVals.length ? Math.min(...daysVals) : 1;
    const dMax = daysVals.length ? Math.max(...daysVals) : 30;
    for (const x of [...liqList].sort((a, b) => a.days - b.days).slice(0, TOP_K)) {
      pushCarInsight(
        InsightType.FASTEST_SELLING,
        x.car,
        `Faster liquidity: ${carTitle(x.car)}`,
        `Estimated ~${x.days.toFixed(0)} days to sell (modelled).`,
        linearNorm(x.days, dMin, dMax, true),
        { avgDaysToSell: x.days },
      );
    }
    for (const x of [...liqList].sort((a, b) => b.days - a.days).slice(0, TOP_K)) {
      pushCarInsight(
        InsightType.SLOWEST_SELLING,
        x.car,
        `Slower liquidity: ${carTitle(x.car)}`,
        `Estimated ~${x.days.toFixed(0)} days to sell.`,
        linearNorm(x.days, dMin, dMax, false),
        { avgDaysToSell: x.days },
      );
    }

    // --- Best investment heuristic
    for (const c of cars) {
      const inv = c.scores?.investmentScore;
      const pred = toNumber(c.pricePrediction?.predictedChange30d);
      const vol = c.marketData?.volatilityScore;
      if (inv == null || pred == null || vol == null) continue;
      if (inv >= 62 && pred > 0.008 && vol >= 42) {
        pushCarInsight(
          InsightType.BEST_INVESTMENT_OPPORTUNITY,
          c,
          `Balanced opportunity profile: ${carTitle(c)}`,
          `Investment score ${inv.toFixed(0)}, positive 30d outlook ~${(pred * 100).toFixed(1)}%, moderate volatility buffer.`,
          clampScore(inv * 0.45 + Math.min(40, pred * 900) + (vol - 40) * 0.35),
          {
            investmentScore: inv,
            predictedChange30d: pred,
            volatilityScore: vol,
          },
        );
      }
    }

    // --- High risk bundle
    for (const c of cars) {
      const risk = c.scores?.riskScore;
      const pred = toNumber(c.marketData?.priceChange30d);
      const vol = c.marketData?.volatilityScore;
      if (risk == null || vol == null) continue;
      if (risk >= 58 && vol <= 38 && pred != null && pred < -0.02) {
        pushCarInsight(
          InsightType.HIGH_RISK_ALERT,
          c,
          `Risk cluster: ${carTitle(c)}`,
          `Elevated risk score with softer prices and choppy market reads.`,
          clampScore(risk * 0.55 + (100 - vol) * 0.25 + Math.abs(pred) * 120),
          { riskScore: risk, volatilityScore: vol, priceChange30d: pred },
        );
      }
    }

    // --- Liquidity / demand spikes (trends)
    const liqTrend = cars
      .filter((c) => c.marketData?.liquidityTrendScore != null)
      .map((c) => ({
        car: c,
        s: c.marketData!.liquidityTrendScore!,
      }))
      .sort((a, b) => b.s - a.s)
      .slice(0, TOP_K);
    const ltMax = liqTrend[0]?.s ?? 1;
    const ltMin = liqTrend[liqTrend.length - 1]?.s ?? 0;
    for (const x of liqTrend) {
      pushCarInsight(
        InsightType.LIQUIDITY_SPIKE,
        x.car,
        `Liquidity momentum: ${carTitle(x.car)}`,
        `Liquidity trend score ${x.s.toFixed(1)}.`,
        linearNorm(x.s, ltMin, ltMax),
        { liquidityTrendScore: x.s },
      );
    }

    const demSpike = cars
      .filter(
        (c) =>
          c.marketData?.demandScore != null &&
          (c.marketData.listingsLast7d ?? 0) > (c.marketData.listingsPrev7d ?? 0),
      )
      .map((c) => ({
        car: c,
        d: c.marketData!.demandScore!,
        g:
          (c.marketData!.listingsLast7d ?? 0) -
          (c.marketData!.listingsPrev7d ?? 0),
      }))
      .sort((a, b) => b.d - a.d)
      .slice(0, TOP_K);
    const dHi = demSpike[0]?.d ?? 1;
    const dLo = demSpike[demSpike.length - 1]?.d ?? 0;
    for (const x of demSpike) {
      pushCarInsight(
        InsightType.DEMAND_SPIKE,
        x.car,
        `Demand uplift with listings growth: ${carTitle(x.car)}`,
        `Demand score ${x.d.toFixed(0)}; recent listing flow rising vs prior week.`,
        linearNorm(x.d, dLo, dHi),
        {
          demandScore: x.d,
          listingsDelta7d: x.g,
        },
      );
    }

    // --- Market cycle regime shifts (segment)
    const prevDay = new Date(snapshotDate);
    prevDay.setUTCDate(prevDay.getUTCDate() - 1);
    const cyclesToday = await this.prisma.marketCycle.findMany({
      where: { snapshotDate },
    });
    const cyclesPrev = await this.prisma.marketCycle.findMany({
      where: { snapshotDate: prevDay },
    });
    const prevMap = new Map(cyclesPrev.map((c) => [c.segment, c.cycleType]));
    for (const c of cyclesToday) {
      const before = prevMap.get(c.segment);
      if (before === c.cycleType) continue;
      if (c.cycleType === MarketCycleType.BULL) {
        pushSegmentInsight(
          InsightType.ENTERING_BULL_TREND,
          c.segment,
          `Bullish regime: ${c.segment}`,
          before
            ? `Cycle moved from ${before} to BULL.`
            : `Segment classified as BULL for ${snapshotDate.toISOString().slice(0, 10)}.`,
          clampScore((c.confidenceScore ?? 55) * 0.9),
          {
            previous: before ?? null,
            cycleType: c.cycleType,
            confidence: c.confidenceScore,
          },
        );
      }
      if (c.cycleType === MarketCycleType.BEAR) {
        pushSegmentInsight(
          InsightType.ENTERING_BEAR_TREND,
          c.segment,
          `Bearish regime: ${c.segment}`,
          before
            ? `Cycle moved from ${before} to BEAR.`
            : `Segment classified as BEAR.`,
          clampScore((c.confidenceScore ?? 55) * 0.95),
          {
            previous: before ?? null,
            cycleType: c.cycleType,
          },
        );
      }
    }

    // --- Segment index rotation & turning points
    const idxRows = await this.prisma.segmentMarketIndex.findMany({
      where: { snapshotDate: { in: [snapshotDate, prevDay] } },
    });
    const tMs = snapshotDate.getTime();
    const pMs = prevDay.getTime();
    const idxBySeg = new Map<
      string,
      { cur?: (typeof idxRows)[0]; prev?: (typeof idxRows)[0] }
    >();
    for (const row of idxRows) {
      const g = idxBySeg.get(row.segment) ?? {};
      const rms = row.snapshotDate.getTime();
      if (rms === tMs) g.cur = row;
      else if (rms === pMs) g.prev = row;
      idxBySeg.set(row.segment, g);
    }
    const rotations: Array<{
      segment: string;
      delta: number;
      cur: number;
      prev?: number;
    }> = [];
    for (const [segment, g] of idxBySeg) {
      if (!g.cur) continue;
      const curV = g.cur.indexValue;
      const prevV = g.prev?.indexValue;
      const delta = prevV != null ? curV - prevV : 0;
      rotations.push({
        segment,
        delta,
        cur: curV,
        prev: prevV,
      });
      const p0 = g.cur.avgPredictedChange30d;
      const p1 = g.prev?.avgPredictedChange30d;
      if (
        p0 != null &&
        p1 != null &&
        p0 !== 0 &&
        p1 !== 0 &&
        Math.sign(p0) !== Math.sign(p1) &&
        Math.abs(p0 - p1) >= 0.15
      ) {
        pushSegmentInsight(
          InsightType.MARKET_TURNING_POINT,
          segment,
          `Momentum inflection: ${segment}`,
          `Average predicted 30d change flipped sign around the latest index snapshot.`,
          clampScore(Math.min(100, Math.abs(p0 - p1) * 120 + 35)),
          {
            avgPredCur: p0,
            avgPredPrev: p1,
            indexValue: curV,
          },
        );
      }
    }
    rotations.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    for (const r of rotations.slice(0, 8)) {
      if (Math.abs(r.delta) < 0.35) continue;
      pushSegmentInsight(
        InsightType.SEGMENT_ROTATION,
        r.segment,
        `Segment rotation: ${r.segment}`,
        r.prev != null
          ? `Composite index moved by ${r.delta.toFixed(1)} pts vs prior day.`
          : `Composite index at ${r.cur.toFixed(1)}.`,
        clampScore(Math.min(100, Math.abs(r.delta) * 8 + 40)),
        { delta: r.delta, indexCur: r.cur, indexPrev: r.prev },
      );
    }

    if (rows.length) {
      await this.prisma.marketInsight.createMany({ data: rows });
    }

    this.logger.log(`Market insights snapshot ${snapshotDate.toISOString().slice(0, 10)} → ${rows.length} rows`);
    return { created: rows.length };
  }

  private segmentMedianPrices(cars: CarRow[]): Map<string, number> {
    const by = new Map<string, number[]>();
    for (const c of cars) {
      const seg = c.segment?.trim();
      if (!seg) continue;
      const p = toNumber(c.marketData?.avgPrice);
      if (p == null) continue;
      const arr = by.get(seg) ?? [];
      arr.push(p);
      by.set(seg, arr);
    }
    const med = new Map<string, number>();
    for (const [k, arr] of by) {
      if (!arr.length) continue;
      const s = [...arr].sort((a, b) => a - b);
      const m = s.length % 2
        ? s[(s.length - 1) / 2]
        : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
      med.set(k, m);
    }
    return med;
  }

  private async loadLatestLiquidityByCar(): Promise<
    Map<string, { avgDaysToSell: number | null }>
  > {
    const raw = await this.prisma.$queryRaw<
      Array<{ carId: string; avgDaysToSell: number | null }>
    >`
      SELECT DISTINCT ON ("carId") "carId", "avgDaysToSell"
      FROM "CarLiquidityStats"
      WHERE "avgDaysToSell" IS NOT NULL
      ORDER BY "carId", "snapshotDate" DESC
    `;
    return new Map(raw.map((r) => [r.carId, { avgDaysToSell: r.avgDaysToSell }]));
  }
}
