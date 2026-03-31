"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { usePortfolioState } from "@/lib/hooks/use-portfolio";
import { useIntelligenceDecision } from "@/lib/hooks/use-intelligence";
import { useUserTriggersAndNotifications } from "@/lib/hooks/use-alerts";
import { useMarketOverview } from "@/lib/hooks/use-market";
import { fmtIRR } from "@/lib/format";

function pickCycleLabel(market: unknown): string | null {
  if (!market || typeof market !== "object") return null;
  const m = market as Record<string, unknown>;
  const mc = m.marketCycle;
  if (typeof mc === "string") return mc;
  if (Array.isArray(mc) && mc[0] && typeof mc[0] === "object") {
    const row = mc[0] as { segment?: string; cycleType?: string };
    return [row.segment, row.cycleType].filter(Boolean).join(" · ") || null;
  }
  return null;
}

export function AppTopbar({
  title,
  userId,
}: {
  title: string;
  userId: string;
}) {
  const { data: port } = usePortfolioState(userId);
  const { data: dec } = useIntelligenceDecision(userId || undefined);
  const { data: trigPack } = useUserTriggersAndNotifications(userId, 40);
  const { data: market } = useMarketOverview();

  const total =
    port &&
    typeof port === "object" &&
    "totalValue" in port &&
    typeof (port as { totalValue: unknown }).totalValue === "number"
      ? (port as { totalValue: number }).totalValue
      : null;

  const risk =
    dec && typeof dec === "object" && "riskLevel" in dec
      ? String((dec as { riskLevel: unknown }).riskLevel)
      : null;

  const notifLen = Array.isArray(
    trigPack &&
      typeof trigPack === "object" &&
      "notifications" in trigPack &&
      (trigPack as { notifications: unknown }).notifications,
  )
    ? (trigPack as { notifications: unknown[] }).notifications.length
    : 0;

  const cycle = pickCycleLabel(market);

  return (
    <header className="sticky top-0 z-10 flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-zinc-200/90 bg-white/85 px-4 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/75 sm:px-6">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h1>
      <div className="flex flex-wrap items-center gap-2">
        {cycle && (
          <Badge variant="strategy" className="max-w-[140px] truncate">
            چرخه: {cycle}
          </Badge>
        )}
        {risk && userId && (
          <Badge variant="warning">ریسک: {risk}</Badge>
        )}
        {userId && total != null && (
          <span className="hidden text-xs tabular-nums text-zinc-600 dark:text-zinc-300 sm:inline">
            سبد: {fmtIRR(total)} تومان
          </span>
        )}
        {userId && (
          <Link
            href={`/alerts?userId=${encodeURIComponent(userId)}`}
            className="relative rounded-lg border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700"
            title="اعلان‌ها"
          >
            🔔
            {notifLen > 0 && (
              <span className="absolute -start-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[10px] text-white">
                {notifLen > 99 ? "۹۹+" : notifLen}
              </span>
            )}
          </Link>
        )}
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-lg border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700">
            حساب
          </summary>
          <div className="absolute end-0 mt-1 w-48 rounded-lg border border-zinc-200 bg-white p-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {userId ? (
              <p className="break-all text-zinc-600 dark:text-zinc-400">
                userId: {userId}
              </p>
            ) : (
              <p className="text-zinc-500">userId تنظیم نشده</p>
            )}
            <Link
              href="/settings"
              className="mt-2 block text-violet-600 hover:underline"
            >
              تنظیمات
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
