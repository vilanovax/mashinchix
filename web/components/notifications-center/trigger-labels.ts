/** عنوان کوتاه فارسی برای نوع تریگر */
export function titleForTriggerType(type: string): string {
  const map: Record<string, string> = {
    PRICE_DROP_THRESHOLD: "آستانهٔ افت قیمت",
    PRICE_SPIKE: "جهش قیمت",
    VOLATILITY_SPIKE: "نوسان بالا",
    LIQUIDITY_DROP: "افت نقدشوندگی",
    DEMAND_SPIKE: "جهش تقاضا",
    SIGNAL_CHANGE: "تغییر سیگنال",
    STRATEGY_CHANGE: "تغییر استراتژی",
    PORTFOLIO_DRIFT: "انحراف سبد",
    WATCHLIST_HIT: "رصد هدف",
    OPPORTUNITY_DETECTED: "فرصت",
    RISK_INCREASE: "ریسک",
    SEGMENT_ROTATION: "چرخش سگمنت",
    MARKET_CYCLE_CHANGE: "چرخهٔ بازار",
  };
  return map[type] ?? type.replaceAll("_", " ");
}
