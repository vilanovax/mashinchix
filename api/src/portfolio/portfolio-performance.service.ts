import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioLedgerService } from './portfolio-ledger.service';

@Injectable()
export class PortfolioPerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: PortfolioLedgerService,
  ) {}

  async getValue(userId: string) {
    const p = await this.ledger.getOrCreatePortfolio(userId);
    await this.ledger.recomputePositions(p.id);
    return {
      ...(await this.ledger.recomputePortfolioValue(p.id)),
      portfolioId: p.id,
    };
  }

  async getPositions(userId: string) {
    const p = await this.ledger.getOrCreatePortfolio(userId);
    await this.ledger.recomputePositions(p.id);
    return this.prisma.portfolioPosition.findMany({
      where: { portfolioId: p.id },
      orderBy: { marketValue: 'desc' },
    });
  }

  async getTransactions(userId: string, take = 80) {
    const p = await this.ledger.getOrCreatePortfolio(userId);
    return this.prisma.portfolioTransaction.findMany({
      where: { portfolioId: p.id },
      orderBy: { executedAt: 'desc' },
      take,
    });
  }

  async getHistory(userId: string, take = 60) {
    const p = await this.ledger.getOrCreatePortfolio(userId);
    return this.prisma.portfolioSnapshot.findMany({
      where: { portfolioId: p.id },
      orderBy: { snapshotDate: 'desc' },
      take,
    });
  }

  async getPerformance(userId: string) {
    const p = await this.ledger.getOrCreatePortfolio(userId);
    const snaps = await this.prisma.portfolioSnapshot.findMany({
      where: { portfolioId: p.id },
      orderBy: { snapshotDate: 'asc' },
      take: 365,
    });

    const txs = await this.prisma.portfolioTransaction.findMany({
      where: { portfolioId: p.id, assetType: 'CAR' },
      orderBy: { executedAt: 'asc' },
    });

    if (!snaps.length) {
      const state = await this.ledger.getPortfolioState(userId);
      return {
        userId,
        portfolioId: p.id,
        totalReturn: null,
        annualReturn: null,
        sharpe: null,
        volatility: null,
        maxDrawdown: null,
        winRate: null,
        bestAsset: null,
        worstAsset: null,
        contributionByAsset: [],
        contributionBySegment: [],
        snapshotCount: 0,
        state,
      };
    }

    const firstV = snaps[0].totalValue;
    const lastV = snaps[snaps.length - 1].totalValue;
    const totalReturn =
      firstV > 1e-9 ? (lastV - firstV) / firstV : null;

    const days = Math.max(
      1,
      (snaps[snaps.length - 1].snapshotDate.getTime() -
        snaps[0].snapshotDate.getTime()) /
        (86400 * 1000),
    );
    const annualReturn =
      totalReturn != null && days > 0
        ? Math.pow(1 + totalReturn, 365 / days) - 1
        : null;

    const rets = snaps
      .slice(1)
      .map((s, i) => {
        const prev = snaps[i].totalValue;
        return prev > 1e-9 ? (s.totalValue - prev) / prev : null;
      })
      .filter((x): x is number => x != null && Number.isFinite(x));

    const mean =
      rets.length > 0 ? rets.reduce((a, b) => a + b, 0) / rets.length : null;
    const variance =
      rets.length > 1
        ? rets.reduce((s, x) => s + (x - (mean ?? 0)) ** 2, 0) /
          (rets.length - 1)
        : null;
    const volatility =
      variance != null && variance > 0 ? Math.sqrt(variance) : null;
    const sharpe =
      volatility != null && volatility > 1e-9 && mean != null
        ? mean / volatility
        : snaps[snaps.length - 1]?.sharpe ?? null;

    let peak = -Infinity;
    let maxDrawdown = 0;
    for (const s of snaps) {
      if (s.totalValue > peak) peak = s.totalValue;
      if (peak > 1e-9) {
        const dd = (s.totalValue - peak) / peak;
        if (dd < maxDrawdown) maxDrawdown = dd;
      }
    }

    const winRate =
      rets.length > 0 ? rets.filter((x) => x > 0).length / rets.length : null;

    const latestPos = snaps[snaps.length - 1].positions;
    const posArr = Array.isArray(latestPos)
      ? (latestPos as Array<{
          assetId?: string;
          assetType?: string;
          label?: string;
          marketValue?: number;
          segment?: string | null;
        }>)
      : [];

    const contrib = posArr
      .filter(
        (x) =>
          x.assetType !== 'CASH' &&
          x.assetId !== 'CASH' &&
          (x.marketValue ?? 0) > 0,
      )
      .map((x) => ({
        assetId: x.assetId,
        label: x.label ?? x.assetId,
        value: x.marketValue ?? 0,
        segment: x.segment ?? null,
      }));

    const totalPosVal = contrib.reduce((s, c) => s + c.value, 0);
    const contributionByAsset = contrib.map((c) => ({
      ...c,
      pct: totalPosVal > 0 ? c.value / totalPosVal : 0,
    }));

    const bySeg = new Map<string, number>();
    for (const c of contrib) {
      const seg = c.segment ?? 'UNKNOWN';
      bySeg.set(seg, (bySeg.get(seg) ?? 0) + c.value);
    }
    const contributionBySegment = [...bySeg].map(([segment, value]) => ({
      segment,
      value,
      pct: totalPosVal > 0 ? value / totalPosVal : 0,
    }));

    const sorted = [...contributionByAsset].sort((a, b) => b.value - a.value);
    const bestAsset = sorted[0]?.label ?? null;
    const worstAsset = sorted.length ? sorted[sorted.length - 1]?.label : null;

    const state = await this.ledger.getPortfolioState(userId);

    return {
      userId,
      portfolioId: p.id,
      totalReturn,
      annualReturn,
      sharpe,
      volatility,
      maxDrawdown: maxDrawdown < 0 ? maxDrawdown : null,
      winRate,
      bestAsset,
      worstAsset,
      contributionByAsset,
      contributionBySegment,
      snapshotCount: snaps.length,
      latestSnapshot: snaps[snaps.length - 1],
      state,
      tradeCount: txs.length,
    };
  }
}
