"use client";

import { ActionButton } from "./action-button";
import type { SeverityLevel } from "./severity-badge";
import { SeverityBadge } from "./severity-badge";
import type { UiNotificationKind } from "@/lib/notifications-center/notification-ui-type";
import { UI_KIND_LABEL } from "@/lib/notifications-center/notification-ui-type";

function formatTime(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("fa-IR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function NotificationItem({
  severity,
  kind,
  title,
  message,
  timestamp,
  relatedLabel,
  read,
  onMarkRead,
}: {
  severity: SeverityLevel;
  kind: UiNotificationKind;
  title: string;
  message: string;
  timestamp: string | Date;
  relatedLabel?: string;
  read: boolean;
  onMarkRead?: () => void;
}) {
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        read
          ? "border-zinc-100 bg-zinc-50/50 dark:border-zinc-900 dark:bg-zinc-950/30"
          : "border-violet-200/80 bg-violet-50/40 dark:border-violet-900/50 dark:bg-violet-950/20"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
        <SeverityBadge severity={severity} />
        <span className="rounded bg-zinc-200/80 px-1.5 py-0.5 dark:bg-zinc-800">
          {UI_KIND_LABEL[kind]}
        </span>
        <time className="ms-auto">{formatTime(timestamp)}</time>
      </div>
      <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {title}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        {message}
      </p>
      {relatedLabel ? (
        <p className="mt-1 text-xs text-violet-600 dark:text-violet-400">
          {relatedLabel}
        </p>
      ) : null}
      {!read && onMarkRead ? (
        <div className="mt-2">
          <ActionButton variant="ghost" className="text-[11px]" onClick={onMarkRead}>
            خوانده شد
          </ActionButton>
        </div>
      ) : null}
    </div>
  );
}
