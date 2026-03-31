"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorPanel, NeedUserIdHint } from "@/components/ui/query-states";
import {
  useUserTriggersAndNotifications,
  useMarketAlertsOverview,
  useAnalyticsAlerts,
} from "@/lib/hooks/use-alerts";
import { useResolvedUserId } from "@/lib/use-resolved-user-id";

function lineItem(x: unknown): string {
  if (typeof x === "object" && x && "title" in x) {
    return String((x as { title: string }).title);
  }
  if (typeof x === "object" && x && "message" in x) {
    return String((x as { message: string }).message);
  }
  return JSON.stringify(x).slice(0, 200);
}

export function AlertsView() {
  const userId = useResolvedUserId();
  const userPack = useUserTriggersAndNotifications(userId, 40);
  const market = useMarketAlertsOverview(32);
  const analytics = useAnalyticsAlerts(24);

  if (!userId) {
    return (
      <AppShell title="هشدارها">
        <NeedUserIdHint />
      </AppShell>
    );
  }

  return (
    <AppShell title="هشدارها">
      <div className="mx-auto max-w-3xl space-y-6">
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            خلاصه
          </p>
          <Card title="منابع">
            <ul className="text-sm text-zinc-600 dark:text-zinc-400">
              <li>
                <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
                  /triggers/user/:userId
                </code>
              </li>
              <li>
                <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
                  /intelligence/alerts
                </code>
              </li>
              <li>
                <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
                  /analytics/alerts
                </code>
              </li>
            </ul>
          </Card>
        </section>

        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            رویدادها و اعلان‌ها
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="تریگرهای کاربر">
              {userPack.isLoading ? (
                <CardSkeleton />
              ) : userPack.isError ? (
                <ErrorPanel
                  message={userPack.error.message}
                  retry={() => void userPack.refetch()}
                />
              ) : (
                <>
                  <p className="mb-2 text-xs text-zinc-500">رویداد</p>
                  <ul className="max-h-48 space-y-1 overflow-auto text-sm">
                    {(
                      (userPack.data as { triggerEvents?: unknown[] })
                        ?.triggerEvents ?? []
                    ).map((ev: unknown, i: number) => (
                      <li key={i}>{lineItem(ev)}</li>
                    ))}
                  </ul>
                  <p className="mb-2 mt-4 text-xs text-zinc-500">اعلان</p>
                  <ul className="max-h-48 space-y-1 overflow-auto text-sm">
                    {(
                      (userPack.data as { notifications?: unknown[] })
                        ?.notifications ?? []
                    ).map((n: unknown, i: number) => (
                      <li key={i}>{lineItem(n)}</li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
            <Card title="هشدار بازار (Intelligence)">
              {market.isLoading ? (
                <CardSkeleton />
              ) : market.isError ? (
                <p className="text-xs text-rose-600">{market.error.message}</p>
              ) : Array.isArray(market.data) && market.data.length ? (
                <ul className="space-y-2 text-sm">
                  {market.data.map((row: unknown, i: number) => (
                    <li key={i}>{lineItem(row)}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">خالی.</p>
              )}
            </Card>
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            آنالیتیکس
          </p>
          <Card title="analytics/alerts">
            {analytics.isLoading ? (
              <CardSkeleton />
            ) : analytics.isError ? (
              <p className="text-xs text-rose-600">{analytics.error.message}</p>
            ) : Array.isArray(analytics.data) && analytics.data.length ? (
              <ul className="space-y-2 text-sm">
                {analytics.data.map((row: unknown, i: number) => (
                  <li key={i}>{lineItem(row)}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">بدون ردیف.</p>
            )}
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
