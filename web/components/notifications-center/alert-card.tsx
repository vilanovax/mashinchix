"use client";

import { ActionButton } from "./action-button";
import { ConfidenceBar } from "./confidence-bar";
import type { SeverityLevel } from "./severity-badge";
import { SeverityBadge } from "./severity-badge";

function formatTime(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("fa-IR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function AlertCard({
  severity,
  title,
  message,
  recommendedAction,
  confidence,
  timestamp,
  relatedLabel,
  onDismiss,
  onMarkRead,
  showMarkRead,
  read,
}: {
  severity: SeverityLevel;
  title: string;
  message: string;
  recommendedAction?: string;
  confidence?: number | null;
  timestamp: string | Date;
  relatedLabel?: string;
  onDismiss?: () => void;
  onMarkRead?: () => void;
  showMarkRead?: boolean;
  read?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-zinc-200/90 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={severity} />
          {read != null && (
            <span className="text-[10px] text-zinc-400">
              {read ? "خوانده‌شده" : "جدید"}
            </span>
          )}
        </div>
        <time className="text-[10px] text-zinc-500">{formatTime(timestamp)}</time>
      </div>
      <h3 className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {message}
      </p>
      {relatedLabel ? (
        <p className="mt-2 text-xs text-violet-600 dark:text-violet-400">
          مرتبط: {relatedLabel}
        </p>
      ) : null}
      {recommendedAction ? (
        <p className="mt-2 rounded-lg bg-zinc-50 px-2 py-1.5 text-xs text-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300">
          <span className="font-medium text-zinc-500">اقدام پیشنهادی: </span>
          {recommendedAction}
        </p>
      ) : null}
      <ConfidenceBar value={confidence} className="mt-3" />
      <div className="mt-3 flex flex-wrap gap-2">
        {showMarkRead && onMarkRead && !read ? (
          <ActionButton variant="primary" onClick={onMarkRead}>
            علامت به‌عنوان خوانده‌شده
          </ActionButton>
        ) : null}
        {onDismiss ? (
          <ActionButton variant="ghost" onClick={onDismiss}>
            پنهان کردن
          </ActionButton>
        ) : null}
      </div>
    </article>
  );
}
