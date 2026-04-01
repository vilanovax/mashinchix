"use client";

import { cn } from "@/lib/cn";
import type { SeverityLevel } from "./severity-badge";

export type SeverityFilter = "ALL" | SeverityLevel;

const ITEMS: { key: SeverityFilter; label: string }[] = [
  { key: "ALL", label: "همه" },
  { key: "HIGH", label: "بحرانی" },
  { key: "MEDIUM", label: "متوسط" },
  { key: "LOW", label: "پایین" },
];

export function AlertSeverityTabs({
  value,
  onChange,
}: {
  value: SeverityFilter;
  onChange: (v: SeverityFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-zinc-200/90 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/50">
      {ITEMS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            value === key
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
