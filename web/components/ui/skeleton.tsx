import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Skeleton({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-zinc-200/80 dark:bg-zinc-800/80",
        className,
      )}
      {...rest}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200/90 p-4 dark:border-zinc-800">
      <Skeleton className="mb-3 h-4 w-1/3" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
