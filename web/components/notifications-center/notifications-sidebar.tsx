"use client";

import { Card } from "@/components/ui/card";

export function NotificationsSidebar({
  unreadNotifications,
  highSeverityCount,
  riskState,
  marketLine,
  advisorConfidence,
  goalLine,
}: {
  unreadNotifications: number;
  highSeverityCount: number;
  riskState: string | null | undefined;
  marketLine: string | null | undefined;
  advisorConfidence: number | null | undefined;
  goalLine: string | null | undefined;
}) {
  const confPct =
    advisorConfidence != null && Number.isFinite(advisorConfidence)
      ? Math.round(
          advisorConfidence * (advisorConfidence <= 1 ? 100 : 1),
        )
      : null;

  return (
    <div className="space-y-4">
      <Card title="خلاصهٔ هشدارها">
        <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <li className="flex justify-between gap-2">
            <span>خوانده‌نشده</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {unreadNotifications}
            </span>
          </li>
          <li className="flex justify-between gap-2">
            <span>سطح بحرانی</span>
            <span className="font-medium text-rose-600 dark:text-rose-400">
              {highSeverityCount}
            </span>
          </li>
        </ul>
      </Card>
      <Card title="ریسک">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {riskState?.trim() || "—"}
        </p>
      </Card>
      <Card title="بازار">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {marketLine?.trim() || "—"}
        </p>
      </Card>
      <Card title="اطمینان مشاور">
        <p className="text-2xl font-semibold text-violet-600 dark:text-violet-400">
          {confPct != null ? `${confPct}%` : "—"}
        </p>
      </Card>
      <Card title="هدف / جهت">
        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          {goalLine?.trim() || "—"}
        </p>
      </Card>
    </div>
  );
}
