import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DATA_PLATFORM_QUEUE } from './data-platform.constants';
import { DivarScraperService } from '../scrapers/divar/divar-scraper.service';
import { AggregatePriceHistoryService } from './aggregate-price-history.service';
import { ListingCleaningService } from './listing-cleaning.service';
import { MarketMetricsService } from './market-metrics.service';
import { CarScoreCalculationService } from '../scoring/car-score-calculation.service';
import { PricePredictionService } from '../prediction/price-prediction.service';
import { SegmentMarketIndexService } from '../prediction/segment-market-index.service';
import { BuySellSignalService } from './buy-sell-signal.service';
import { BehaviorMetricsService } from '../tracking/behavior-metrics.service';
import { UserPreferenceLearningService } from '../tracking/user-preference-learning.service';
import { CarLiquidityStatsService } from './car-liquidity-stats.service';
import { MarketCycleService } from './market-cycle.service';
import { MarketInsightsService } from './market-insights.service';
import { MarketAlertsService } from './market-alerts.service';
import { MarketReportService } from '../analytics/market-report.service';
import { UserNotificationService } from '../delivery/user-notification.service';
import { PersonalizedInsightsService } from '../delivery/personalized-insights.service';
import { ModelEvaluationBatchService } from '../model-evaluation/model-evaluation-batch.service';

@Processor(DATA_PLATFORM_QUEUE)
export class DataPlatformProcessor extends WorkerHost {
  private readonly logger = new Logger(DataPlatformProcessor.name);

  constructor(
    private readonly divar: DivarScraperService,
    private readonly cleaning: ListingCleaningService,
    private readonly aggregate: AggregatePriceHistoryService,
    private readonly metrics: MarketMetricsService,
    private readonly pricePrediction: PricePredictionService,
    private readonly segmentIndex: SegmentMarketIndexService,
    private readonly liquidityStats: CarLiquidityStatsService,
    private readonly marketCycle: MarketCycleService,
    private readonly carScores: CarScoreCalculationService,
    private readonly buySellSignals: BuySellSignalService,
    private readonly marketInsights: MarketInsightsService,
    private readonly marketAlerts: MarketAlertsService,
    private readonly userNotifications: UserNotificationService,
    private readonly personalizedInsights: PersonalizedInsightsService,
    private readonly marketReport: MarketReportService,
    private readonly behaviorMetrics: BehaviorMetricsService,
    private readonly preferenceLearning: UserPreferenceLearningService,
    private readonly modelEvaluationBatch: ModelEvaluationBatchService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Job start: ${job.name} (${job.id})`);
    try {
      switch (job.name) {
        case 'scrape-divar':
          return await this.divar.scrapeAndPersist(
            job.data as { maxListings?: number } | undefined,
          );
        case 'clean-listings':
          return await this.cleaning.run(
            job.data as { since?: Date; resetExclusions?: boolean } | undefined,
          );
        case 'aggregate-price-history':
          return await this.aggregate.aggregateFromListings(
            job.data as { since?: Date } | undefined,
          );
        case 'market-metrics':
          return await this.metrics.recomputeAll();
        case 'recompute-price-predictions': {
          const pred = await this.pricePrediction.recomputeAll();
          const seg = await this.segmentIndex.recomputeAll();
          return { ...pred, ...seg };
        }
        case 'recompute-car-liquidity-stats':
          return await this.liquidityStats.recomputeDaily(
            (job.data as { date?: string } | undefined)?.date,
          );
        case 'recompute-market-cycle':
          return await this.marketCycle.recomputeAll(
            (job.data as { date?: string } | undefined)?.date,
          );
        case 'recompute-car-scores':
          return await this.carScores.recomputeAll();
        case 'recompute-buy-sell-signals':
          return await this.buySellSignals.recomputeAll();
        case 'generate-market-insights': {
          const d = (job.data as { date?: string } | undefined)?.date;
          return await this.marketInsights.generateInsights(
            d ? new Date(d) : undefined,
          );
        }
        case 'generate-market-alerts':
          return await this.marketAlerts.generateAlerts();
        case 'generate-user-notifications':
          return await this.userNotifications.generateNotifications();
        case 'generate-personalized-insights':
          return await this.personalizedInsights.generatePersonalizedInsights();
        case 'generate-market-reports': {
          const { id } = await this.marketReport.generateDailyReport();
          if (new Date().getUTCDay() === 0) {
            await this.marketReport.generateWeeklyReport();
          }
          await this.userNotifications.notifyDailyMarketReport(id);
          return { dailyReportId: id };
        }
        case 'recompute-behavior-metrics-daily':
          return await this.behaviorMetrics.recomputeDaily(
            (job.data as { date?: string } | undefined)?.date,
          );
        case 'recompute-user-preference-signals':
          return await this.preferenceLearning.recomputeAllActiveUsers();
        case 'run-model-evaluation': {
          const asOfStr = (job.data as { asOf?: string } | undefined)?.asOf;
          const asOf = asOfStr ? new Date(asOfStr) : new Date();
          return await this.modelEvaluationBatch.runAll(asOf);
        }
        default:
          throw new Error(`Unknown data-platform job: ${job.name}`);
      }
    } finally {
      this.logger.log(`Job done: ${job.name} (${job.id})`);
    }
  }
}
