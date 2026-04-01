"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorPanel } from "@/components/ui/query-states";
import {
  EventTimeline,
  NotificationsShell,
  NotificationsSidebar,
} from "@/components/notifications-center";
import type { TimelineItem } from "@/components/notifications-center";
import {
  useExecutionHistoryMe,
  useIntelligenceHistory,
} from "@/lib/hooks/use-alerts";
import { useAdvisorHistory, useAdvisorSummary } from "@/lib/hooks/use-advisor";

type AdvisorSnap = {
  id: string;
  snapshotDate: string;
  summary?: string | null;
  briefing?: string | null;
};

type ExecPlan = {
  id: string;
  createdAt: string;
  summary: string;
};

type IntelSnap = {
  id: string;
  snapshotDate: string;
  briefing?: string | null;
  bestStrategy?: string | null;
};

function buildItems(
  advisorRows: AdvisorSnap[] | undefined,
  execRows: ExecPlan[] | undefined,
  intelRows: IntelSnap[] | undefined,
): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const a of advisorRows ?? []) {
    const sub = (a.summary || a.briefing || "").trim() || "اسنپ‌شات مشاور بدون متن.";
    out.push({
      id: `advisor-${a.id}`,
      at: a.snapshotDate,
      title: "اسنپ‌شات مشاور / اقدام روز",
      subtitle: sub.slice(0, 320),
      badge: "مشاور",
    });
  }
  for (const e of execRows ?? []) {
    out.push({
      id: `exec-${e.id}`,
      at: e.createdAt,
      title: "برنامه یا اجرای سبد",
      subtitle: (e.summary || "").trim().slice(0, 320) || "رکورد اجرا.",
      badge: "اجرا",
    });
  }
  for (const s of intelRows ?? []) {
    const title = s.bestStrategy
      ? `چرخهٔ بازار — ${s.bestStrategy}`
      : "هوش تجمیعی بازار";
    out.push({
      id: `intel-${s.id}`,
      at: s.snapshotDate,
      title,
      subtitle: (s.briefing || "").trim().slice(0, 320) || "به‌روزرسانی اسنپ‌شات جهانی.",
      badge: "بازار",
    });
  }
  out.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
  return out;
}

export function EventsView() {
  const advisorH = useAdvisorHistory(45);
  const execH = useExecutionHistoryMe(45);
  const intelH = useIntelligenceHistory(28);
  const advisor = useAdvisorSummary();

  const advisorRow = advisor.data as
    | {
        riskState?: string | null;
        marketState?: string | null;
        confidence?: number | null;
        summary?: string | null;
        briefing?: string | null;
      }
    | undefined;

  const sidebar = (
    <NotificationsSidebar
      unreadNotifications={0}
      highSeverityCount={0}
      riskState={advisorRow?.riskState}
      marketLine={advisorRow?.marketState ?? null}
      advisorConfidence={advisorRow?.confidence ?? null}
      goalLine={
        (advisorRow?.briefing || advisorRow?.summary)?.slice(0, 220) ?? null
      }
    />
  );

  const loading = advisorH.isLoading || execH.isLoading || intelH.isLoading;
  const dualFail = advisorH.isError && execH.isError;

  const items = useMemo(
    () =>
      buildItems(
        advisorH.isSuccess ? (advisorH.data as AdvisorSnap[]) : undefined,
        execH.isSuccess ? (execH.data as ExecPlan[]) : undefined,
        intelH.isSuccess ? (intelH.data as IntelSnap[]) : undefined,
      ),
    [
      advisorH.isSuccess,
      advisorH.data,
      execH.isSuccess,
      execH.data,
      intelH.isSuccess,
      intelH.data,
    ],
  );

  if (loading) {
    return (
      <NotificationsShell title="رویدادها" sidebar={sidebar}>
        <CardSkeleton />
      </NotificationsShell>
    );
  }

  if (dualFail) {
    return (
      <NotificationsShell title="رویدادها" sidebar={sidebar}>
        <ErrorPanel
          message={`${advisorH.error?.message ?? ""} ${execH.error?.message ?? ""}`.trim()}
          retry={() => {
            void advisorH.refetch();
            void execH.refetch();
            void intelH.refetch();
          }}
        />
      </NotificationsShell>
    );
  }

  return (
    <NotificationsShell title="رویدادها" sidebar={sidebar}>
      <Card title="تایم‌لاین">
        <p className="mb-4 text-xs text-zinc-500">
          ترکیب{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            /advisor/history
          </code>
          ،{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            /execution/history/me
          </code>{" "}
          و{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            /intelligence/history
          </code>
          .
        </p>
        {intelH.isError ? (
          <p className="mb-3 text-xs text-amber-700 dark:text-amber-300">
            تاریخچهٔ هوش بازار بارگذاری نشد؛ بقیهٔ رویدادها نمایش داده می‌شود.
          </p>
        ) : null}
        <EventTimeline items={items} />
      </Card>
    </NotificationsShell>
  );
}
