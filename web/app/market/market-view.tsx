"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorPanel } from "@/components/ui/query-states";
import {
  useMarketOverview,
  useAnalyticsMarketCycles,
  useAnalyticsMarketMomentum,
  useAnalyticsLiquidityTrends,
} from "@/lib/hooks/use-market";
import { useMarketAlertsOverview } from "@/lib/hooks/use-alerts";

function normScores(vals: number[]): (v: number) => number {
  if (!vals.length) return () => 0.5;
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  if (hi === lo) return () => 0.5;
  return (v: number) => (v - lo) / (hi - lo);
}

function HeatCells({
  label,
  entries,
  valueKey,
}: {
  label: string;
  entries: { key: string; v: number }[];
  valueKey: string;
}) {
  if (!entries.length) {
    return (
      <Card title={label}>
        <p className="text-sm text-zinc-500">داده‌ای نیست.</p>
      </Card>
    );
  }
  const vals = entries.map((e) => e.v);
  const n = normScores(vals);
  return (
    <Card title={label}>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
        {entries.slice(0, 12).map((e) => {
          const t = n(e.v);
          return (
            <div
              key={e.key}
              className="rounded py-3 text-center text-[10px] text-white"
              style={{
                backgroundColor: `rgba(16, 185, 129, ${0.25 + t * 0.65})`,
              }}
            >
              <div className="font-medium">{e.key}</div>
              <div className="opacity-90">{valueKey}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function MarketView() {
  const market = useMarketOverview();
  const cycles = useAnalyticsMarketCycles();
  const momentum = useAnalyticsMarketMomentum();
  const liquidity = useAnalyticsLiquidityTrends();
  const intelAlerts = useMarketAlertsOverview(24);

  const overviewErr = market.isError;
  if (overviewErr) {
    return (
      <AppShell title="بازار">
        <ErrorPanel
          message={market.error?.message ?? "خطا"}
          retry={() => void market.refetch()}
        />
      </AppShell>
    );
  }

  const mdata = market.data as Record<string, unknown> | undefined;
  const cycleRows = Array.isArray(cycles.data) ? cycles.data : [];

  const momRows = Array.isArray(momentum.data) ? momentum.data : [];
  const momBySeg = new Map<string, number[]>();
  for (const r of momRows) {
    if (typeof r !== "object" || !r) continue;
    const seg =
      (r as { car?: { segment?: string | null } }).car?.segment ?? "—";
    const sc = (r as { momentumScore?: number | null }).momentumScore;
    if (sc == null || !Number.isFinite(sc)) continue;
    if (!momBySeg.has(seg)) momBySeg.set(seg, []);
    momBySeg.get(seg)!.push(sc);
  }
  const momEntries = [...momBySeg.entries()].map(([key, vals]) => ({
    key,
    v: vals.reduce((a, b) => a + b, 0) / vals.length,
  }));

  const liqRows = Array.isArray(liquidity.data) ? liquidity.data : [];
  const liqBySeg = new Map<string, number[]>();
  for (const r of liqRows) {
    if (typeof r !== "object" || !r) continue;
    const seg =
      (r as { car?: { segment?: string | null } }).car?.segment ?? "—";
    const sc = (r as { liquidityTrendScore?: number | null })
      .liquidityTrendScore;
    if (sc == null || !Number.isFinite(sc)) continue;
    if (!liqBySeg.has(seg)) liqBySeg.set(seg, []);
    liqBySeg.get(seg)!.push(sc);
  }
  const liqEntries = [...liqBySeg.entries()].map(([key, vals]) => ({
    key,
    v: vals.reduce((a, b) => a + b, 0) / vals.length,
  }));

  const volEntries = momRows
    .map((r, i) => {
      if (typeof r !== "object" || !r) return null;
      const seg =
        (r as { car?: { segment?: string | null } }).car?.segment ?? "—";
      const ch = (r as { priceChange90d?: number | null }).priceChange90d;
      if (ch == null || !Number.isFinite(ch)) return null;
      return { key: `${seg}-${i}`, v: Math.abs(ch) };
    })
    .filter((x): x is { key: string; v: number } => x != null)
    .slice(0, 12);

  const loading =
    market.isLoading && !market.data;

  return (
    <AppShell title="بازار">
      <div className="mx-auto max-w-6xl space-y-6">
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            خلاصه
          </p>
          {loading ? (
            <CardSkeleton />
          ) : (
            <Card title="چرخه و نمای بازار">
              <div className="flex flex-wrap gap-2">
                {typeof mdata?.marketState === "string" && (
                  <Badge variant="info">{mdata.marketState}</Badge>
                )}
              </div>
              {mdata?.briefing != null && mdata.briefing !== "" && (
                <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {String(mdata.briefing)}
                </p>
              )}
            </Card>
          )}
        </section>

        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            روند چرخه (تحلیل)
          </p>
          <Card title="/analytics/market/cycles">
            {cycles.isLoading ? (
              <CardSkeleton />
            ) : cycles.isError ? (
              <p className="text-xs text-rose-600">{cycles.error.message}</p>
            ) : cycleRows.length ? (
              <div className="max-h-56 overflow-auto text-xs">
                <table className="w-full">
                  <thead className="sticky top-0 bg-white text-zinc-500 dark:bg-zinc-950">
                    <tr>
                      <th className="pb-2 text-right">تاریخ</th>
                      <th className="pb-2">سگمنت</th>
                      <th className="pb-2">نوع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cycleRows.slice(0, 20).map(
                      (
                        row: {
                          id: string;
                          snapshotDate: string;
                          segment: string;
                          cycleType: string;
                        },
                      ) => (
                        <tr
                          key={row.id}
                          className="border-t border-zinc-100 dark:border-zinc-800"
                        >
                          <td className="py-1">
                            {new Intl.DateTimeFormat("fa-IR").format(
                              new Date(row.snapshotDate),
                            )}
                          </td>
                          <td>{row.segment}</td>
                          <td>{row.cycleType}</td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">ردیفی نیست.</p>
            )}
          </Card>
        </section>

        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            نقشه‌ها
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            {momentum.isLoading ? (
              <CardSkeleton />
            ) : (
              <HeatCells
                label="مومنتوم (میانگین سگمنت)"
                entries={momEntries}
                valueKey="score"
              />
            )}
            {liquidity.isLoading ? (
              <CardSkeleton />
            ) : (
              <HeatCells
                label="روند نقدشوندگی"
                entries={liqEntries}
                valueKey="liq"
              />
            )}
            <HeatCells
              label="نوسان (|Δ۹۰d| نمونه‌ها)"
              entries={volEntries}
              valueKey="vol"
            />
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            هشدارها
          </p>
          <Card title="/intelligence/alerts">
            {intelAlerts.isLoading ? (
              <CardSkeleton />
            ) : intelAlerts.isError ? (
              <p className="text-xs text-rose-600">
                {intelAlerts.error.message}
              </p>
            ) : Array.isArray(intelAlerts.data) && intelAlerts.data.length ? (
              <ul className="space-y-2 text-sm text-rose-800 dark:text-rose-200">
                {intelAlerts.data.slice(0, 12).map((row: unknown, i: number) => (
                  <li key={i}>
                    {typeof row === "object" && row && "title" in row
                      ? String((row as { title: string }).title)
                      : JSON.stringify(row).slice(0, 160)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">خالی.</p>
            )}
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
