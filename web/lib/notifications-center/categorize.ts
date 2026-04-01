/** دسته‌بندی تریگرهای موتور برای تب‌های هشدار */

export const MARKET_TRIGGER_TYPES = new Set([
  "MARKET_CYCLE_CHANGE",
  "VOLATILITY_SPIKE",
  "LIQUIDITY_DROP",
  "DEMAND_SPIKE",
  "SEGMENT_ROTATION",
  "PRICE_DROP_THRESHOLD",
  "PRICE_SPIKE",
  "SIGNAL_CHANGE",
]);

export const RISK_TRIGGER_TYPES = new Set(["RISK_INCREASE"]);

export const PORTFOLIO_TRIGGER_TYPES = new Set([
  "PORTFOLIO_DRIFT",
  "STRATEGY_CHANGE",
  "WATCHLIST_HIT",
  "OPPORTUNITY_DETECTED",
]);

export type AlertBucket = "risk" | "market" | "portfolio" | "trigger";

export function bucketForTriggerType(type: string): Exclude<AlertBucket, "trigger"> | null {
  if (RISK_TRIGGER_TYPES.has(type)) return "risk";
  if (PORTFOLIO_TRIGGER_TYPES.has(type)) return "portfolio";
  if (MARKET_TRIGGER_TYPES.has(type)) return "market";
  return null;
}

/** اعلان‌های دیتابیس → سطل نمایش در صفحهٔ هشدارها */
export function bucketForNotificationType(type: string): Exclude<AlertBucket, "trigger"> | null {
  if (type === "HIGH_RISK") return "risk";
  if (
    type === "MARKET_ALERT" ||
    type === "MARKET_REPORT" ||
    type === "PRICE_DROP" ||
    type === "PRICE_RISE"
  ) {
    return "market";
  }
  if (
    type === "RECOMMENDATION" ||
    type === "WATCHLIST_UPDATE" ||
    type === "BUY_SIGNAL" ||
    type === "SELL_SIGNAL"
  ) {
    return "portfolio";
  }
  return null;
}
