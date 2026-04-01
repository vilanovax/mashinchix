"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorPanel } from "@/components/ui/query-states";
import { useTodayAdvisor } from "@/lib/hooks/use-advisor";
import { usePortfolioState } from "@/lib/hooks/use-portfolio";
import { useUserTriggersAndNotifications } from "@/lib/hooks/use-alerts";
import { useMarketOverview } from "@/lib/hooks/use-market";
import { useIntelligenceOpportunities } from "@/lib/hooks/use-intelligence";
import { useSessionOrDevUserId } from "@/lib/use-resolved-user-id";
import { fmtIRR, fmtRatioAsPct } from "@/lib/format";
import type { TodayActionPlanResponse } from "./today-types";

function confidencePct(c: number | null | undefined): number {
  if (c == null || !Number.isFinite(c)) return 0;
  return c <= 1 ? c * 100 : Math.min(100, c);
}

function oppLine(o: unknown): string {
  if (typeof o === "object" && o && "title" in o) {
    return String((o as { title: string }).title);
  }
  if (typeof o === "string") return o;
  return JSON.stringify(o).slice(0, 160);
}

export function TodayView() {
  const devId = useSessionOrDevUserId();
  const advisor = useTodayAdvisor(devId);
  const portfolio = usePortfolioState(devId);
  const triggers = useUserTriggersAndNotifications(devId, 30);
  const market = useMarketOverview();
  const extraOpps = useIntelligenceOpportunities(8);

  if (advisor.isError) {
    return (
      <AppShell title="اقدام امروز">
        <ErrorPanel
          message={advisor.error?.message ?? "خطا"}
          retry={() => void advisor.refetch()}
        />
      </AppShell>
    );
  }

  const a = advisor.data as TodayActionPlanResponse | undefined;
  const port = portfolio.data as
    | {
        totalValue?: number;
        return30d?: number | null;
        sharpe?: number | null;
      }
    | undefined;
  const events = (
    triggers.data && typeof triggers.data === "object"
      ? (triggers.data as { triggerEvents?: unknown[] }).triggerEvents
      : undefined
  ) as unknown[] | undefined;

  const loading = advisor.isLoading || portfolio.isLoading;

  return (
    <AppShell title="اقدام امروز">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* خلاصه */}
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            خلاصه
          </p>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Card title="بازار">
                <div className="flex flex-wrap gap-2">
                  {a?.marketState && (
                    <Badge variant="info">{a.marketState}</Badge>
                  )}
                  {typeof market.data === "object" &&
                    market.data &&
                    "briefing" in market.data &&
                    (market.data as { briefing: string | null }).briefing && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {String(
                          (market.data as { briefing: string }).briefing,
                        ).slice(0, 200)}
                      </p>
                    )}
                </div>
              </Card>
              <Card title="سبد">
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-zinc-500">ارزش</p>
                    <p className="font-semibold tabular-nums">
                      {fmtIRR(port?.totalValue)} تومان
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">بازده ۳۰روز</p>
                    <p className="font-semibold">
                      {fmtRatioAsPct(port?.return30d ?? null)}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </section>

        {/* اقدامات */}
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            اقدامات پیشنهادی
          </p>
          <Card title="پیشنهادهای امروز">
            {loading ? (
              <CardSkeleton />
            ) : a?.recommendedActions?.length ? (
              <ol className="list-inside list-decimal space-y-3 text-sm text-zinc-800 dark:text-zinc-200">
                {a.recommendedActions.map((act, i) => (
                  <li key={`${act.type}-${i}`}>
                    <span className="font-medium">{act.title}</span>
                    {act.description && (
                      <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
                        {act.description}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-zinc-500">اقدامی پیشنهاد نشده.</p>
            )}
          </Card>
        </section>

        {/* اثر مورد انتظار */}
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            اثر مورد انتظار
          </p>
          <Card title="اثر مورد انتظار">
            {loading ? (
              <CardSkeleton />
            ) : a?.expectedImpact ? (
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span className="text-zinc-500">تغییر بازده</span>
                  <span className="font-medium">
                    {fmtRatioAsPct(a.expectedImpact.returnChange)}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-zinc-500">تغییر ریسک</span>
                  <span className="font-medium">
                    {fmtRatioAsPct(a.expectedImpact.riskChange)}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-zinc-500">شارپ</span>
                  <span className="font-medium tabular-nums">
                    {a.expectedImpact.sharpeChange != null
                      ? new Intl.NumberFormat("fa-IR", {
                          maximumSignificantDigits: 3,
                        }).format(a.expectedImpact.sharpeChange)
                      : "—"}
                  </span>
                </li>
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">بدون داده.</p>
            )}
          </Card>
        </section>

        {/* هشدارها */}
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            هشدارها
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="هشدارهای مشاور">
              {loading ? (
                <CardSkeleton />
              ) : a?.warnings?.length ? (
                <ul className="list-disc space-y-1 ps-4 text-sm text-amber-800 dark:text-amber-200">
                  {a.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">بدون هشدار.</p>
              )}
            </Card>
            <Card title="رویدادهای تریگر اخیر">
              {triggers.isLoading ? (
                <CardSkeleton />
              ) : triggers.isError ? (
                <p className="text-xs text-rose-600">{triggers.error.message}</p>
              ) : events?.length ? (
                <ul className="max-h-48 space-y-1 overflow-auto text-xs text-zinc-600 dark:text-zinc-400">
                  {events.slice(0, 12).map((ev, i) => (
                    <li key={i}>
                      {typeof ev === "object" && ev && "message" in ev
                        ? String((ev as { message: string }).message)
                        : JSON.stringify(ev).slice(0, 120)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">رویدادی نیست.</p>
              )}
            </Card>
          </div>
        </section>

        {/* فرصت‌ها */}
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            فرصت‌ها
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="فرصت‌ها (مشاور)">
              {loading ? (
                <CardSkeleton />
              ) : a?.opportunities?.length ? (
                <ul className="space-y-2 text-sm text-emerald-800 dark:text-emerald-200">
                  {a.opportunities.map((o, i) => (
                    <li key={i}>{oppLine(o)}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">از مشاور فرصتی نیامد.</p>
              )}
            </Card>
            <Card title="فرصت‌ها (Intelligence)">
              {extraOpps.isLoading ? (
                <CardSkeleton />
              ) : Array.isArray(extraOpps.data) && extraOpps.data.length ? (
                <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {extraOpps.data.map((o: unknown, i: number) => (
                    <li key={i}>{oppLine(o)}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">خالی یا خطا.</p>
              )}
            </Card>
          </div>
        </section>

        {/* اطمینان + متن */}
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            اطمینان و جمع‌بندی
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="اطمینان مشاور">
              <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                ترکیب سیگنال‌ها و اجرای طرح
              </p>
              <ProgressBar value={confidencePct(a?.confidence)} tone="confidence" />
            </Card>
            <Card title="خلاصهٔ مشاور">
              {loading ? (
                <CardSkeleton />
              ) : (
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {a?.summary ||
                    a?.briefing ||
                    "خلاصه‌ای از سرور برنگشت."}
                </p>
              )}
            </Card>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
