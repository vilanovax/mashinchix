"use client";

import { cn } from "@/lib/cn";

export type TimelineItem = {
  id: string;
  at: string | Date;
  title: string;
  subtitle: string;
  badge?: string;
};

function formatTime(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function EventTimeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) {
    return (
      <p className="text-center text-sm text-zinc-500">رویدادی برای نمایش نیست.</p>
    );
  }

  return (
    <ol className="relative space-y-0 border-s-2 border-zinc-200 ps-6 dark:border-zinc-800">
      {items.map((item, i) => (
        <li key={item.id} className="relative pb-8 last:pb-0">
          <span
            className={cn(
              "absolute -start-[9px] top-1.5 size-3 rounded-full border-2 border-white bg-violet-500 dark:border-zinc-950 dark:bg-violet-400",
              i === 0 && "ring-2 ring-violet-200 dark:ring-violet-900",
            )}
          />
          <div className="pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                {formatTime(item.at)}
              </span>
              {item.badge ? (
                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  {item.badge}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {item.title}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {item.subtitle}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
