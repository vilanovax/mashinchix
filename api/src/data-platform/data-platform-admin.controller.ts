import { InjectQueue } from '@nestjs/bullmq';
import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { DATA_PLATFORM_QUEUE } from './data-platform.constants';

@Controller('admin/data-platform')
export class DataPlatformAdminController {
  constructor(
    @InjectQueue(DATA_PLATFORM_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  /**
   * دستی همان pipeline شبانه را صف می‌کند (مفید برای dev).
   * در production پیشنهاد: BasicAuth / API Key.
   */
  @Post('enqueue')
  async enqueue(
    @Body()
    body: {
      delayCleanMs?: number;
      delayAggregateMs?: number;
      delayMetricsMs?: number;
      delayPredictionsMs?: number;
      delayLiquidityStatsMs?: number;
      delayMarketCycleMs?: number;
      delayScoresMs?: number;
      delayBuySellMs?: number;
      delayBehaviorMetricsMs?: number;
      delayPreferenceSignalsMs?: number;
    } = {},
  ) {
    if (this.config.get<string>('ALLOW_DATA_PLATFORM_ADMIN') !== 'true') {
      return {
        ok: false,
        error:
          'Set ALLOW_DATA_PLATFORM_ADMIN=true in .env to enable this endpoint',
      };
    }

    const delayClean =
      body.delayCleanMs ??
      this.config.get<number>('DATA_JOB_CLEAN_DELAY_MS') ??
      120_000;
    const delayAgg =
      body.delayAggregateMs ??
      this.config.get<number>('DATA_JOB_AGGREGATE_DELAY_MS') ??
      600_000;
    const delayMetrics =
      body.delayMetricsMs ??
      this.config.get<number>('DATA_JOB_METRICS_DELAY_MS') ??
      1_200_000;
    const delayPredictions =
      body.delayPredictionsMs ??
      this.config.get<number>('DATA_JOB_PREDICTIONS_DELAY_MS') ??
      delayMetrics + 120_000;
    const delayLiquidityStats =
      body.delayLiquidityStatsMs ??
      this.config.get<number>('DATA_JOB_LIQUIDITY_STATS_DELAY_MS') ??
      delayPredictions + 90_000;
    const delayMarketCycle =
      body.delayMarketCycleMs ??
      this.config.get<number>('DATA_JOB_MARKET_CYCLE_DELAY_MS') ??
      delayLiquidityStats + 90_000;
    const delayScores =
      body.delayScoresMs ??
      this.config.get<number>('DATA_JOB_SCORES_DELAY_MS') ??
      delayMarketCycle + 180_000;
    const delayBuySell =
      body.delayBuySellMs ??
      this.config.get<number>('DATA_JOB_BUY_SELL_DELAY_MS') ??
      delayScores + 180_000;
    const delayBehavior =
      body.delayBehaviorMetricsMs ??
      this.config.get<number>('DATA_JOB_BEHAVIOR_METRICS_DELAY_MS') ??
      delayBuySell + 120_000;
    const delayPreferenceSignals =
      body.delayPreferenceSignalsMs ??
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

    return {
      ok: true,
      delayCleanMs: delayClean,
      delayAggregateMs: delayAgg,
      delayMetricsMs: delayMetrics,
      delayPredictionsMs: delayPredictions,
      delayLiquidityStatsMs: delayLiquidityStats,
      delayMarketCycleMs: delayMarketCycle,
      delayScoresMs: delayScores,
      delayBuySellMs: delayBuySell,
      delayBehaviorMetricsMs: delayBehavior,
      delayPreferenceSignalsMs: delayPreferenceSignals,
    };
  }
}
