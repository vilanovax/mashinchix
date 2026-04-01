"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorPanel } from "@/components/ui/query-states";
import {
  AlertCard,
  AlertFilter,
  AlertSeverityTabs,
  NotificationsShell,
  NotificationsSidebar,
} from "@/components/notifications-center";
import type { SeverityFilter } from "@/components/notifications-center";
import type { SeverityLevel } from "@/components/notifications-center";
import {
  useMarkNotificationRead,
  useMarketAlertsOverview,
  useUserTriggersAndNotifications,
} from "@/lib/hooks/use-alerts";
import { useAdvisorSummary } from "@/lib/hooks/use-advisor";
import { useSessionOrDevUserId } from "@/lib/use-resolved-user-id";
import {
  bucketForNotificationType,
  bucketForTriggerType,
} from "@/lib/notifications-center/categorize";
import {
  dismissTriggerId,
  getDismissedTriggerIds,
} from "@/lib/notifications-center/dismissed-triggers";
import { titleForTriggerType } from "@/components/notifications-center/trigger-labels";

type TriggerEv = {
  id: string;
  type: string;
  severity: SeverityLevel;
  message: string;
  action: string;
  confidence?: number | null;
  carId?: string | null;
  segment?: string | null;
  createdAt: string;
};

type UserNotif = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: SeverityLevel;
  isRead: boolean;
  carId?: string | null;
  segment?: string | null;
  createdAt: string;
};

type MarketRow = {
  id: string;
  alertType: string;
  message: string;
  severity: SeverityLevel;
  carId?: string | null;
  segment?: string | null;
  createdAt: string;
  car?: { brand?: string; model?: string } | null;
};

function relatedLabel(seg?: string | null, car?: { brand?: string; model?: string } | null) {
  if (car?.brand && car?.model) return `${car.brand} ${car.model}`;
  if (seg) return `سگمنت: ${seg}`;
  return undefined;
}

function matchesQuery(
  q: string,
  parts: (string | undefined | null)[],
): boolean {
  if (!q.trim()) return true;
  const n = q.trim().toLowerCase();
  return parts.some((p) => (p?.toLowerCase().includes(n)));
}

function severityOk(filter: SeverityFilter, s: SeverityLevel): boolean {
  if (filter === "ALL") return true;
  return s === filter;
}

const MARKET_ALERT_TITLE: Record<string, string> = {
  PRICE_DROP: "هشدار افت قیمت",
  VOLATILITY_SPIKE: "نوسان شدید",
  MARKET_ENTERING_BEAR: "ورود به روند نزولی",
  MARKET_ENTERING_BULL: "ورود به روند صعودی",
  CAR_ILLIQUID: "نقدشوندگی پایین خودرو",
  BEST_INVESTMENT_SIGNAL: "سیگنال سرمایه‌گذاری",
  SEGMENT_OVERHEATING: "گرم‌شدن سگمنت",
  SEGMENT_CRASH_RISK: "ریسک افت سگمنت",
};

export function AlertsView() {
  const devId = useSessionOrDevUserId();
  const pack = useUserTriggersAndNotifications(devId, 60);
  const market = useMarketAlertsOverview(32);
  const advisor = useAdvisorSummary();
  const markRead = useMarkNotificationRead();

  const [filterQ, setFilterQ] = useState("");
  const [sevTab, setSevTab] = useState<SeverityFilter>("ALL");
  const [hiddenTriggers, setHiddenTriggers] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setHiddenTriggers(getDismissedTriggerIds());
  }, []);

  const dismissTrigger = useCallback((id: string) => {
    dismissTriggerId(id);
    setHiddenTriggers((prev) => new Set(prev).add(id));
  }, []);

  const data = pack.data as
    | { triggerEvents?: TriggerEv[]; notifications?: UserNotif[] }
    | undefined;

  const triggers = useMemo(
    () =>
      (data?.triggerEvents ?? []).filter((t) => !hiddenTriggers.has(t.id)),
    [data?.triggerEvents, hiddenTriggers],
  );
  const notifications = useMemo(
    () => data?.notifications ?? [],
    [data?.notifications],
  );

  const sidebarCounts = useMemo(() => {
    const unread = notifications.filter((n) => !n.isRead).length;
    const high =
      [...triggers, ...notifications].filter((x) => x.severity === "HIGH")
        .length +
      (Array.isArray(market.data)
        ? (market.data as MarketRow[]).filter((m) => m.severity === "HIGH")
            .length
        : 0);
    return { unread, high };
  }, [triggers, notifications, market.data]);

  const advisorRow = advisor.data as
    | {
        riskState?: string | null;
        marketState?: string | null;
        portfolioState?: string | null;
        confidence?: number | null;
        summary?: string | null;
        briefing?: string | null;
      }
    | undefined;

  const filterTrigger = useCallback(
    (t: TriggerEv) => {
      if (!severityOk(sevTab, t.severity)) return false;
      return matchesQuery(filterQ, [
        t.message,
        t.action,
        titleForTriggerType(t.type),
        t.segment,
      ]);
    },
    [filterQ, sevTab],
  );

  const filterNotif = useCallback(
    (n: UserNotif) => {
      if (!severityOk(sevTab, n.severity)) return false;
      return matchesQuery(filterQ, [n.title, n.message, n.type, n.segment]);
    },
    [filterQ, sevTab],
  );

  const filterMarket = useCallback(
    (m: MarketRow) => {
      if (!severityOk(sevTab, m.severity)) return false;
      return matchesQuery(filterQ, [
        m.message,
        m.alertType,
        m.segment,
        relatedLabel(m.segment, m.car),
      ]);
    },
    [filterQ, sevTab],
  );

  const triggerSection = useMemo(
    () => triggers.filter(filterTrigger),
    [triggers, filterTrigger],
  );

  const riskItems = useMemo(() => {
    const tt = triggers.filter(
      (t) => bucketForTriggerType(t.type) === "risk" && filterTrigger(t),
    );
    const nn = notifications.filter(
      (n) => bucketForNotificationType(n.type) === "risk" && filterNotif(n),
    );
    return { triggers: tt, notifications: nn };
  }, [triggers, notifications, filterTrigger, filterNotif]);

  const marketItems = useMemo(() => {
    const tt = triggers.filter(
      (t) => bucketForTriggerType(t.type) === "market" && filterTrigger(t),
    );
    const nn = notifications.filter(
      (n) => bucketForNotificationType(n.type) === "market" && filterNotif(n),
    );
    const rows = Array.isArray(market.data)
      ? (market.data as MarketRow[]).filter(filterMarket)
      : [];
    return { triggers: tt, notifications: nn, marketRows: rows };
  }, [triggers, notifications, market.data, filterTrigger, filterNotif, filterMarket]);

  const portfolioItems = useMemo(() => {
    const tt = triggers.filter(
      (t) =>
        bucketForTriggerType(t.type) === "portfolio" && filterTrigger(t),
    );
    const nn = notifications.filter(
      (n) =>
        bucketForNotificationType(n.type) === "portfolio" && filterNotif(n),
    );
    return { triggers: tt, notifications: nn };
  }, [triggers, notifications, filterTrigger, filterNotif]);

  const sidebar = (
    <NotificationsSidebar
      unreadNotifications={sidebarCounts.unread}
      highSeverityCount={sidebarCounts.high}
      riskState={advisorRow?.riskState}
      marketLine={advisorRow?.marketState ?? null}
      advisorConfidence={advisorRow?.confidence ?? null}
      goalLine={
        (advisorRow?.briefing || advisorRow?.summary || advisorRow?.portfolioState)?.slice(
          0,
          220,
        ) ?? null
      }
    />
  );

  if (pack.isLoading) {
    return (
      <NotificationsShell title="هشدارها" sidebar={sidebar}>
        <CardSkeleton />
        <CardSkeleton />
      </NotificationsShell>
    );
  }

  if (pack.isError) {
    return (
      <NotificationsShell title="هشدارها" sidebar={sidebar}>
        <ErrorPanel
          message={pack.error.message}
          retry={() => void pack.refetch()}
        />
      </NotificationsShell>
    );
  }

  return (
    <NotificationsShell title="هشدارها" sidebar={sidebar}>
      <div className="space-y-3">
        <AlertFilter value={filterQ} onChange={setFilterQ} />
        <AlertSeverityTabs value={sevTab} onChange={setSevTab} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          رویدادهای تریگر
        </h2>
        <div className="space-y-3">
          {triggerSection.length ? (
            triggerSection.map((t) => (
              <AlertCard
                key={t.id}
                severity={t.severity}
                title={titleForTriggerType(t.type)}
                message={t.message}
                recommendedAction={t.action}
                confidence={t.confidence}
                timestamp={t.createdAt}
                relatedLabel={relatedLabel(t.segment, null)}
                onDismiss={() => dismissTrigger(t.id)}
              />
            ))
          ) : (
            <p className="text-sm text-zinc-500">موردی نیست.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          هشدار ریسک
        </h2>
        <div className="space-y-3">
          {riskItems.triggers.map((t) => (
            <AlertCard
              key={t.id}
              severity={t.severity}
              title={titleForTriggerType(t.type)}
              message={t.message}
              recommendedAction={t.action}
              confidence={t.confidence}
              timestamp={t.createdAt}
              relatedLabel={relatedLabel(t.segment, null)}
              onDismiss={() => dismissTrigger(t.id)}
            />
          ))}
          {riskItems.notifications.map((n) => (
            <AlertCard
              key={n.id}
              severity={n.severity}
              title={n.title}
              message={n.message}
              recommendedAction="بررسی سبد و محدودیت ریسک مطابق مشاور."
              confidence={null}
              timestamp={n.createdAt}
              relatedLabel={relatedLabel(n.segment, null)}
              showMarkRead
              read={n.isRead}
              onMarkRead={() => void markRead.mutateAsync(n.id)}
            />
          ))}
          {!riskItems.triggers.length && !riskItems.notifications.length ? (
            <p className="text-sm text-zinc-500">موردی نیست.</p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          هشدار بازار
        </h2>
        {market.isError ? (
          <p className="text-xs text-rose-600">{market.error.message}</p>
        ) : (
          <div className="space-y-3">
            {marketItems.triggers.map((t) => (
              <AlertCard
                key={t.id}
                severity={t.severity}
                title={titleForTriggerType(t.type)}
                message={t.message}
                recommendedAction={t.action}
                confidence={t.confidence}
                timestamp={t.createdAt}
                relatedLabel={relatedLabel(t.segment, null)}
                onDismiss={() => dismissTrigger(t.id)}
              />
            ))}
            {marketItems.notifications.map((n) => (
              <AlertCard
                key={n.id}
                severity={n.severity}
                title={n.title}
                message={n.message}
                recommendedAction="مرور سیگنال بازار و قیمت‌های مرجع."
                confidence={null}
                timestamp={n.createdAt}
                relatedLabel={relatedLabel(n.segment, null)}
                showMarkRead
                read={n.isRead}
                onMarkRead={() => void markRead.mutateAsync(n.id)}
              />
            ))}
            {marketItems.marketRows.map((m) => (
              <AlertCard
                key={m.id}
                severity={m.severity}
                title={
                  MARKET_ALERT_TITLE[m.alertType] ?? m.alertType.replaceAll("_", " ")
                }
                message={m.message}
                recommendedAction="ارزیابی تأثیر بر سبد و برنامهٔ اجرا."
                confidence={null}
                timestamp={m.createdAt}
                relatedLabel={relatedLabel(m.segment, m.car ?? null)}
              />
            ))}
            {!marketItems.triggers.length &&
            !marketItems.notifications.length &&
            !marketItems.marketRows.length ? (
              <p className="text-sm text-zinc-500">موردی نیست.</p>
            ) : null}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          هشدار سبد / Portfolios
        </h2>
        <div className="space-y-3">
          {portfolioItems.triggers.map((t) => (
            <AlertCard
              key={t.id}
              severity={t.severity}
              title={titleForTriggerType(t.type)}
              message={t.message}
              recommendedAction={t.action}
              confidence={t.confidence}
              timestamp={t.createdAt}
              relatedLabel={relatedLabel(t.segment, null)}
              onDismiss={() => dismissTrigger(t.id)}
            />
          ))}
          {portfolioItems.notifications.map((n) => (
            <AlertCard
              key={n.id}
              severity={n.severity}
              title={n.title}
              message={n.message}
              recommendedAction="تنظیم وزن‌ها یا تأیید پیشنهاد مشاور."
              confidence={null}
              timestamp={n.createdAt}
              relatedLabel={relatedLabel(n.segment, null)}
              showMarkRead
              read={n.isRead}
              onMarkRead={() => void markRead.mutateAsync(n.id)}
            />
          ))}
          {!portfolioItems.triggers.length && !portfolioItems.notifications.length ? (
            <p className="text-sm text-zinc-500">موردی نیست.</p>
          ) : null}
        </div>
      </section>

      <Card title="آنالیتیکس و منبع داده">
        <p className="text-xs text-zinc-500">
          بسته از{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">/alerts</code>{" "}
          ، هشدارهای بازار از{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            /intelligence/alerts
          </code>{" "}
          و خلاصهٔ مشاور از{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            /advisor/summary
          </code>
          .
        </p>
      </Card>
    </NotificationsShell>
  );
}
