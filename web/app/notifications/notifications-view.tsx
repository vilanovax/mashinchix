"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorPanel } from "@/components/ui/query-states";
import {
  AlertFilter,
  NotificationItem,
  NotificationsShell,
  NotificationsSidebar,
} from "@/components/notifications-center";
import {
  useMarkNotificationRead,
  useUserTriggersAndNotifications,
} from "@/lib/hooks/use-alerts";
import { useAdvisorSummary } from "@/lib/hooks/use-advisor";
import { useSessionOrDevUserId } from "@/lib/use-resolved-user-id";
import {
  bucketForDate,
  DAY_BUCKET_LABEL,
  type DayBucket,
} from "@/lib/notifications-center/dates";
import {
  UI_KIND_LABEL,
  uiKindFromNotificationType,
  type UiNotificationKind,
} from "@/lib/notifications-center/notification-ui-type";
import type { SeverityLevel } from "@/components/notifications-center";

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

function related(seg?: string | null) {
  return seg ? `سگمنت: ${seg}` : undefined;
}

const BUCKET_ORDER: DayBucket[] = ["today", "yesterday", "earlier"];

export function NotificationsView() {
  const devId = useSessionOrDevUserId();
  const pack = useUserTriggersAndNotifications(devId, 80);
  const advisor = useAdvisorSummary();
  const markRead = useMarkNotificationRead();
  const [q, setQ] = useState("");

  const notifications = (
    (pack.data as { notifications?: UserNotif[] } | undefined)?.notifications ??
    []
  ).slice();

  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    if (!nq) return notifications;
    return notifications.filter(
      (n) =>
        n.title.toLowerCase().includes(nq) ||
        n.message.toLowerCase().includes(nq) ||
        n.type.toLowerCase().includes(nq),
    );
  }, [notifications, q]);

  const grouped = useMemo(() => {
    const m = new Map<DayBucket, UserNotif[]>();
    for (const b of BUCKET_ORDER) m.set(b, []);
    for (const n of filtered) {
      const bucket = bucketForDate(n.createdAt);
      m.get(bucket)!.push(n);
    }
    for (const b of BUCKET_ORDER) {
      m.get(b)!.sort(
        (a, c) => new Date(c.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return m;
  }, [filtered]);

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

  const unread = notifications.filter((n) => !n.isRead).length;
  const high = notifications.filter((n) => n.severity === "HIGH").length;

  const sidebar = (
    <NotificationsSidebar
      unreadNotifications={unread}
      highSeverityCount={high}
      riskState={advisorRow?.riskState}
      marketLine={advisorRow?.marketState ?? null}
      advisorConfidence={advisorRow?.confidence ?? null}
      goalLine={
        (advisorRow?.briefing || advisorRow?.summary)?.slice(0, 220) ?? null
      }
    />
  );

  if (pack.isLoading) {
    return (
      <NotificationsShell title="اعلان‌ها" sidebar={sidebar}>
        <CardSkeleton />
      </NotificationsShell>
    );
  }

  if (pack.isError) {
    return (
      <NotificationsShell title="اعلان‌ها" sidebar={sidebar}>
        <ErrorPanel
          message={pack.error.message}
          retry={() => void pack.refetch()}
        />
      </NotificationsShell>
    );
  }

  const legendKeys: UiNotificationKind[] = [
    "advisor_recommendation",
    "portfolio_rebalance",
    "risk_warning",
    "opportunity",
    "strategy_change",
    "execution",
    "performance",
    "market",
    "other",
  ];

  return (
    <NotificationsShell title="اعلان‌ها" sidebar={sidebar}>
      <AlertFilter value={q} onChange={setQ} />
      <Card title="راهنمای انواع">
        <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          {legendKeys.map((k) => UI_KIND_LABEL[k]).join(" · ")}
        </p>
      </Card>

      {BUCKET_ORDER.map((bucket) => {
        const items = grouped.get(bucket)!;
        if (!items.length) return null;
        return (
          <section key={bucket} className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {DAY_BUCKET_LABEL[bucket]}
            </h2>
            <div className="space-y-2">
              {items.map((n) => {
                const kind = uiKindFromNotificationType(n.type);
                return (
                  <NotificationItem
                    key={n.id}
                    severity={n.severity}
                    kind={kind}
                    title={n.title}
                    message={n.message}
                    timestamp={n.createdAt}
                    relatedLabel={related(n.segment)}
                    read={n.isRead}
                    onMarkRead={
                      n.isRead
                        ? undefined
                        : () => void markRead.mutateAsync(n.id)
                    }
                  />
                );
              })}
            </div>
          </section>
        );
      })}

      {!filtered.length ? (
        <p className="text-center text-sm text-zinc-500">اعلانی نیست.</p>
      ) : null}
    </NotificationsShell>
  );
}
