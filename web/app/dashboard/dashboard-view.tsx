"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorPanel, NeedUserIdHint } from "@/components/ui/query-states";
import {
  usePortfolioState,
  usePortfolioPerformance,
} from "@/lib/hooks/use-portfolio";
import { useMarketOverview } from "@/lib/hooks/use-market";
import { useIntelligenceOpportunities } from "@/lib/hooks/use-intelligence";
import { useIntelligenceStrategy } from "@/lib/hooks/use-intelligence";
import { useIntelligenceDecision } from "@/lib/hooks/use-intelligence";
import { useAnalyticsAlerts } from "@/lib/hooks/use-alerts";
import { useResolvedUserId } from "@/lib/use-resolved-user-id";
import { MiniPortfolioChart } from "@/components/charts/mini-line";
import { fmtIRR, fmtRatioAsPct } from "@/lib/format";
import Link from "next/link";

export function DashboardView() {
  const userId = useResolvedUserId();
  const port = usePortfolioState(userId);
  const perf = usePortfolioPerformance(userId);
  const market = useMarketOverview();
  const opps = useIntelligenceOpportunities(12);
  const strat = useIntelligenceStrategy(userId || undefined);
  const dec = useIntelligenceDecision(userId || undefined);
  const analyticsAlerts = useAnalyticsAlerts(20);

  const loading =
    (!!userId && (port.isLoading || perf.isLoading)) ||
    market.isLoading ||
    opps.isLoading;

  if (!userId) {
    return (
      <AppShell title="داشبورد">
        <NeedUserIdHint />
      </AppShell>
    );
  }

  if (port.isError || perf.isError) {
    return (
      <AppShell title="داشبورد">
        <ErrorPanel
          message={(port.error ?? perf.error)?.message ?? "خطای ناشناخته"}
          retry={() => {
            void port.refetch();
            void perf.refetch();
          }}
        />
      </AppShell>
    );
  }

  const state = port.data as
    | {
        totalValue?: number;
        cash?: number;
        invested?: number;
        return30d?: number | null;
        positions?: { asset?: string; weight?: number; value?: number }[];
      }
    | undefined;

  const performance = perf.data as
    | {
        totalReturn?: number | null;
        sharpe?: number | null;
        maxDrawdown?: number | null;
        state?: { return30d?: number | null; sharpe?: number | null };
      }
    | undefined;

  const mdata = market.data as Record<string, unknown> | undefined;
  const riskLevel =
    dec.data && typeof dec.data === "object" && "riskLevel" in dec.data
      ? String((dec.data as { riskLevel: unknown }).riskLevel)
      : null;

  const stratTitle =
    strat.data && typeof strat.data === "object" && "primary" in strat.data
      ? (strat.data as { primary?: { title?: string } }).primary?.title
      : null;

  const alertsRows = Array.isArray(analyticsAlerts.data)
    ? analyticsAlerts.data
    : [];

  return (
    <AppShell title="داشبورد">
      <div className="mx-auto max-w-6xl space-y-6">
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            خلاصه
          </p>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <Card title="ارزش سبد">
                <p className="text-2xl font-semibold tabular-nums">
                  {fmtIRR(state?.totalValue)}{" "}
                  <span className="text-base font-normal text-zinc-500">
                    تومان
                  </span>
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  نقد: {fmtIRR(state?.cash)} · سرمایه‌گذاری‌شده:{" "}
                  {fmtIRR(state?.invested)}
                </p>
              </Card>
              <Card title="بازار">
                <Badge variant="strategy">
                  {(mdata?.briefing as string)?.slice(0, 80) || "نمای بازار"}
                </Badge>
                <p className="mt-2 text-xs text-zinc-500">
                  منبع: /intelligence/market
                </p>
              </Card>
              <Card title="ریسک / تصمیم">
                {riskLevel && (
                  <Badge variant="warning">{riskLevel}</Badge>
                )}
                <p className="mt-2 text-xs text-zinc-500">
                  /intelligence/decision
                </p>
              </Card>
            </div>
          )}
        </section>

        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            عملکرد و تنوع
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card title="روند ارزش (نمونه)">
              <MiniPortfolioChart />
            </Card>
            <Card title="بازده و شارپ">
              {perf.isLoading ? (
                <CardSkeleton />
              ) : (
                <>
                  <p className="text-sm">
                    بازده کل:{" "}
                    <span className="font-medium">
                      {fmtRatioAsPct(performance?.totalReturn ?? null)}
                    </span>
                  </p>
                  <p className="text-sm">
                    شارپ:{" "}
                    <span className="font-medium tabular-nums">
                      {performance?.sharpe != null
                        ? performance.sharpe.toFixed(2)
                        : "—"}
                    </span>
                  </p>
                  <p className="text-sm">
                    افت:{" "}
                    <span className="font-medium">
                      {performance?.maxDrawdown != null
                        ? fmtRatioAsPct(-Math.abs(performance.maxDrawdown))
                        : "—"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    /portfolio/performance
                  </p>
                </>
              )}
            </Card>
            <Card title="بازده ۳۰ روزه (اسنپ‌شات)">
              <p className="text-lg font-semibold">
                {fmtRatioAsPct(state?.return30d ?? null)}
              </p>
              <p className="text-xs text-zinc-500">از /portfolio/state</p>
            </Card>
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            فرصت‌ها و هشدارها
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Card
              title="فرصت‌ها"
              action={
                <Link
                  href="/opportunities"
                  className="text-xs text-violet-600 hover:underline"
                >
                  همه
                </Link>
              }
            >
              {opps.isLoading ? (
                <CardSkeleton />
              ) : Array.isArray(opps.data) && opps.data.length ? (
                <ul className="space-y-2 text-sm">
                  {opps.data.slice(0, 6).map((o: unknown, i: number) => (
                    <li key={i} className="text-zinc-700 dark:text-zinc-300">
                      {typeof o === "object" && o && "title" in o
                        ? String((o as { title: string }).title)
                        : JSON.stringify(o).slice(0, 80)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">فرصتی برنگرداند.</p>
              )}
            </Card>
            <Card
              title="هشدارهای آنالیتیکس"
              action={
                <Link
                  href="/alerts"
                  className="text-xs text-rose-600 hover:underline"
                >
                  مدیریت
                </Link>
              }
            >
              {analyticsAlerts.isLoading ? (
                <CardSkeleton />
              ) : alertsRows.length ? (
                <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {alertsRows.slice(0, 5).map((a: unknown, i: number) => (
                    <li key={i}>
                      {typeof a === "object" && a && "title" in a
                        ? String((a as { title: string }).title)
                        : String(a).slice(0, 120)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">خالی یا بدون دسترسی.</p>
              )}
            </Card>
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            استراتژی و تنوع
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="استراتژی">
              <Badge variant="strategy">{stratTitle ?? "—"}</Badge>
              <p className="mt-2 text-xs text-zinc-500">/intelligence/strategy</p>
            </Card>
            <Card title="تنوع (وزن‌ها)">
              {state?.positions?.length ? (
                <div className="space-y-2">
                  {state.positions.slice(0, 5).map((p, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>{p.asset}</span>
                        <span>{fmtRatioAsPct(p.weight ?? null)}</span>
                      </div>
                      <ProgressBar
                        value={Math.min(
                          100,
                          p.weight != null && p.weight <= 1
                            ? p.weight * 100
                            : (p.weight ?? 0),
                        )}
                        tone="confidence"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">موقعیتی نیست.</p>
              )}
            </Card>
          </div>
        </section>

        <div className="text-center">
          <Link
            href={`/today?userId=${encodeURIComponent(userId)}`}
            className="inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            اقدام امروز
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
