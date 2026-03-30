import { Injectable, Logger } from '@nestjs/common';
import { MarketReportFrequency, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarketIntelligenceAnalyticsService } from './market-intelligence-analytics.service';

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

@Injectable()
export class MarketReportService {
  private readonly logger = new Logger(MarketReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly intel: MarketIntelligenceAnalyticsService,
  ) {}

  async generateDailyReport(): Promise<{ id: string }> {
    const reportDate = startOfUtcDay(new Date());
    const payload = await this.intel.marketReport();

    const row = await this.prisma.marketReport.upsert({
      where: {
        reportDate_frequency: {
          reportDate,
          frequency: MarketReportFrequency.DAILY,
        },
      },
      create: this.buildCreate(reportDate, MarketReportFrequency.DAILY, payload),
      update: this.buildUpdate(payload),
    });

    this.logger.log(`Daily market report upserted: ${row.id}`);
    return { id: row.id };
  }

  async generateWeeklyReport(): Promise<{ id: string }> {
    const reportDate = startOfUtcDay(new Date());
    const payload = await this.intel.marketReport();
    const title = `گزارش هفتگی بازار — ${reportDate.toISOString().slice(0, 10)}`;
    const summary = `خلاصه هفتگی: ${payload.topRisingCars?.length ?? 0} خودرو با روند صعودی ذخیره‌شده، هشدارهای فعال: ${payload.activeAlertsCount ?? 0}.`;

    const row = await this.prisma.marketReport.upsert({
      where: {
        reportDate_frequency: {
          reportDate,
          frequency: MarketReportFrequency.WEEKLY,
        },
      },
      create: {
        reportDate,
        frequency: MarketReportFrequency.WEEKLY,
        title,
        summary,
        ...this.jsonBlocks(payload),
        metadata: {
          kind: 'weekly',
          generatedFor: payload.generatedFor,
        } as Prisma.InputJsonValue,
      },
      update: {
        title,
        summary,
        ...this.jsonBlocks(payload),
        metadata: {
          kind: 'weekly',
          generatedFor: payload.generatedFor,
        } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Weekly market report upserted: ${row.id}`);
    return { id: row.id };
  }

  private buildCreate(
    reportDate: Date,
    frequency: MarketReportFrequency,
    payload: Awaited<ReturnType<MarketIntelligenceAnalyticsService['marketReport']>>,
  ): Prisma.MarketReportCreateInput {
    const title = `گزارش روزانه بازار — ${reportDate.toISOString().slice(0, 10)}`;
    const summary = `شاخص‌ها و خودروهای برتر برای ${payload.generatedFor}. هشدارهای فعال: ${payload.activeAlertsCount ?? 0}.`;
    return {
      reportDate,
      frequency,
      title,
      summary,
      ...this.jsonBlocks(payload),
      metadata: {
        generatedFor: payload.generatedFor,
      } as Prisma.InputJsonValue,
    };
  }

  private buildUpdate(
    payload: Awaited<ReturnType<MarketIntelligenceAnalyticsService['marketReport']>>,
  ): Prisma.MarketReportUpdateInput {
    const summary = `شاخص‌ها و خودروهای برتر برای ${payload.generatedFor}. هشدارهای فعال: ${payload.activeAlertsCount ?? 0}.`;
    return {
      summary,
      ...this.jsonBlocks(payload),
      metadata: {
        generatedFor: payload.generatedFor,
      } as Prisma.InputJsonValue,
    };
  }

  private jsonBlocks(
    payload: Awaited<ReturnType<MarketIntelligenceAnalyticsService['marketReport']>>,
  ): {
    marketCycle: Prisma.InputJsonValue;
    topRisingCars: Prisma.InputJsonValue;
    topFallingCars: Prisma.InputJsonValue;
    bestInvestments: Prisma.InputJsonValue;
    highestRiskCars: Prisma.InputJsonValue;
    fastestSellingCars: Prisma.InputJsonValue;
    segmentTrends: Prisma.InputJsonValue;
    volatilityOverview: Prisma.InputJsonValue;
    liquidityOverview: Prisma.InputJsonValue;
  } {
    return {
      marketCycle: payload.marketCycle as Prisma.InputJsonValue,
      topRisingCars: payload.topRisingCars as Prisma.InputJsonValue,
      topFallingCars: payload.topFallingCars as Prisma.InputJsonValue,
      bestInvestments: payload.bestInvestments as Prisma.InputJsonValue,
      highestRiskCars: payload.highestRiskCars as Prisma.InputJsonValue,
      fastestSellingCars: payload.fastestSellingCars as Prisma.InputJsonValue,
      segmentTrends: payload.segmentTrends as Prisma.InputJsonValue,
      volatilityOverview: payload.volatilityOverview as Prisma.InputJsonValue,
      liquidityOverview: payload.liquidityOverview as Prisma.InputJsonValue,
    };
  }

  async latestReport(frequency: MarketReportFrequency = MarketReportFrequency.DAILY) {
    return this.prisma.marketReport.findFirst({
      where: { frequency },
      orderBy: { reportDate: 'desc' },
    });
  }

  async history(opts: { limit?: number; frequency?: MarketReportFrequency }) {
    const take = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    return this.prisma.marketReport.findMany({
      where: opts.frequency ? { frequency: opts.frequency } : undefined,
      orderBy: [{ reportDate: 'desc' }],
      take,
    });
  }
}
