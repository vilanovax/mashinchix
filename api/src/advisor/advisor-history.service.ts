import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdvisorHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async persist(input: {
    userId: string;
    snapshotDate: Date;
    marketState: string | null;
    portfolioState: string | null;
    riskState: string | null;
    actions: unknown;
    expectedImpact: unknown;
    warnings: unknown;
    opportunities: unknown;
    confidence: number | null;
    summary: string | null;
    briefing: string | null;
  }) {
    return this.prisma.advisorSnapshot.create({
      data: {
        userId: input.userId,
        snapshotDate: input.snapshotDate,
        marketState: input.marketState,
        portfolioState: input.portfolioState,
        riskState: input.riskState,
        actions: input.actions as Prisma.InputJsonValue,
        expectedImpact: input.expectedImpact as Prisma.InputJsonValue,
        warnings: input.warnings as Prisma.InputJsonValue,
        opportunities: input.opportunities as Prisma.InputJsonValue,
        confidence: input.confidence,
        summary: input.summary,
        briefing: input.briefing,
      },
    });
  }

  async listForUser(userId: string, limit = 30) {
    const take = Math.min(Math.max(limit, 1), 120);
    return this.prisma.advisorSnapshot.findMany({
      where: { userId },
      orderBy: { snapshotDate: 'desc' },
      take,
    });
  }
}
