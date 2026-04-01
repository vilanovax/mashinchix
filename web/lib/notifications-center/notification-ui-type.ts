/** نوع نمایشی برای صفحهٔ «اعلان‌ها» مطابق پرامپت */

export type UiNotificationKind =
  | "advisor_recommendation"
  | "portfolio_rebalance"
  | "risk_warning"
  | "opportunity"
  | "strategy_change"
  | "execution"
  | "performance"
  | "market"
  | "other";

export const UI_KIND_LABEL: Record<UiNotificationKind, string> = {
  advisor_recommendation: "توصیهٔ مشاور",
  portfolio_rebalance: "تنظیم مجدد سبد",
  risk_warning: "هشدار ریسک",
  opportunity: "فرصت شناسایی‌شده",
  strategy_change: "تغییر استراتژی",
  execution: "اجرا تکمیل شد",
  performance: "نقطهٔ عطف عملکرد",
  market: "بازار",
  other: "سایر",
};

export function uiKindFromNotificationType(type: string): UiNotificationKind {
  switch (type) {
    case "RECOMMENDATION":
      return "advisor_recommendation";
    case "WATCHLIST_UPDATE":
      return "portfolio_rebalance";
    case "HIGH_RISK":
      return "risk_warning";
    case "BUY_SIGNAL":
    case "SELL_SIGNAL":
    case "INSIGHT":
      return "opportunity";
    case "TRIGGER_ENGINE":
      return "strategy_change";
    case "MARKET_ALERT":
    case "MARKET_REPORT":
    case "PRICE_DROP":
    case "PRICE_RISE":
      return "market";
    default:
      return "other";
  }
}
