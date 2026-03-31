import { TriggerEngineType } from '@prisma/client';

export const TRIGGER_KEY_BY_TYPE: Partial<Record<TriggerEngineType, string>> = {
  [TriggerEngineType.PRICE_DROP_THRESHOLD]: 'price_drop_pct',
  [TriggerEngineType.PRICE_SPIKE]: 'price_spike',
  [TriggerEngineType.VOLATILITY_SPIKE]: 'volatility_spike',
  [TriggerEngineType.LIQUIDITY_DROP]: 'liquidity_drop',
  [TriggerEngineType.DEMAND_SPIKE]: 'demand_spike',
  [TriggerEngineType.PORTFOLIO_DRIFT]: 'portfolio_drift_pct',
  [TriggerEngineType.RISK_INCREASE]: 'risk_increase_threshold',
  [TriggerEngineType.SEGMENT_ROTATION]: 'segment_rotation_pct',
  [TriggerEngineType.MARKET_CYCLE_CHANGE]: 'segment_rotation_pct',
};

export function thresholdForTriggerType(
  adaptive: Record<string, number>,
  type: TriggerEngineType,
  fallback: number,
): number {
  const key = TRIGGER_KEY_BY_TYPE[type];
  const v = key ? adaptive[key] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
