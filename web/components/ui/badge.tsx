import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

const variants = {
  neutral: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  danger: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  info: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  strategy: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
};

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
