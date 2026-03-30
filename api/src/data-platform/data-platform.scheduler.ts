import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { DATA_PLATFORM_QUEUE } from './data-platform.constants';

/**
 * زمان‌بندی شبانه: اسکرپ → (تأخیر) تجمیع تاریخچه → (تأخیر) متریک بازار.
 * با DISABLE_DATA_CRON=true غیرفعال. با DATA_CRON از env الگوی cron را عوض کنید.
 */
@Injectable()
export class DataPlatformScheduler {
  private readonly logger = new Logger(DataPlatformScheduler.name);

  constructor(
    @InjectQueue(DATA_PLATFORM_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  @Cron(process.env.DATA_CRON || CronExpression.EVERY_DAY_AT_3AM)
  async scheduleNightlyPipeline(): Promise<void> {
    if (this.config.get<string>('DISABLE_DATA_CRON') === 'true') {
      return;
    }

    const delayClean =
      this.config.get<number>('DATA_JOB_CLEAN_DELAY_MS') ?? 120_000;
    const delayAgg =
      this.config.get<number>('DATA_JOB_AGGREGATE_DELAY_MS') ?? 600_000;
    const delayMetrics =
      this.config.get<number>('DATA_JOB_METRICS_DELAY_MS') ?? 1_200_000;
    const delayPredictions =
      this.config.get<number>('DATA_JOB_PREDICTIONS_DELAY_MS') ??
      delayMetrics + 120_000;
    const delayLiquidityStats =
      this.config.get<number>('DATA_JOB_LIQUIDITY_STATS_DELAY_MS') ??
      delayPredictions + 90_000;
    const delayMarketCycle =
      this.config.get<number>('DATA_JOB_MARKET_CYCLE_DELAY_MS') ??
      delayLiquidityStats + 90_000;
    const delayScores =
      this.config.get<number>('DATA_JOB_SCORES_DELAY_MS') ??
      delayMarketCycle + 180_000;
    const delayBuySell =
      this.config.get<number>('DATA_JOB_BUY_SELL_DELAY_MS') ??
      delayScores + 180_000;
    const delayBehavior =
      this.config.get<number>('DATA_JOB_BEHAVIOR_METRICS_DELAY_MS') ??
      delayBuySell + 120_000;
    const delayPreferenceSignals =
      this.config.get<number>('DATA_JOB_PREFERENCE_SIGNALS_DELAY_MS') ??
      delayBehavior + 120_000;

    await this.queue.add('scrape-divar', {}, { removeOnComplete: 50 });
    await this.queue.add(
      'clean-listings',
      {},
      { delay: delayClean, removeOnComplete: 50 },
    );
    await this.queue.add(
      'aggregate-price-history',
      {},
      { delay: delayAgg, removeOnComplete: 50 },
    );
    await this.queue.add(
      'market-metrics',
      {},
      { delay: delayMetrics, removeOnComplete: 50 },
    );
    await this.queue.add(
      'recompute-price-predictions',
      {},
      { delay: delayPredictions, removeOnComplete: 50 },
    );
    await this.queue.add(
      'recompute-car-liquidity-stats',
      {},
      { delay: delayLiquidityStats, removeOnComplete: 50 },
    );
    await this.queue.add(
      'recompute-market-cycle',
      {},
      { delay: delayMarketCycle, removeOnComplete: 50 },
    );
    await this.queue.add(
      'recompute-car-scores',
      {},
      { delay: delayScores, removeOnComplete: 50 },
    );
    await this.queue.add(
      'recompute-buy-sell-signals',
      {},
      { delay: delayBuySell, removeOnComplete: 50 },
    );
    await this.queue.add(
      'recompute-behavior-metrics-daily',
      {},
      { delay: delayBehavior, removeOnComplete: 50 },
    );
    await this.queue.add(
      'recompute-user-preference-signals',
      {},
      { delay: delayPreferenceSignals, removeOnComplete: 50 },
    );

    this.logger.log(
      `Enqueued pipeline: clean +${delayClean}ms, aggregate +${delayAgg}ms, metrics +${delayMetrics}ms, predictions +${delayPredictions}ms, liquidity +${delayLiquidityStats}ms, cycle +${delayMarketCycle}ms, scores +${delayScores}ms, buySell +${delayBuySell}ms, behavior +${delayBehavior}ms, prefs +${delayPreferenceSignals}ms`,
    );
  }
}
