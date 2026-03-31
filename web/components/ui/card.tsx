import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  children,
  className,
  action,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-zinc-200/90 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800/80">
          <div>
            {title && (
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
