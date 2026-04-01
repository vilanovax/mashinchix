import { cn } from "@/lib/cn";

export function ConfidenceBar({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  const v =
    value != null && Number.isFinite(value)
      ? Math.min(100, Math.max(0, Math.round(value * (value <= 1 ? 100 : 1))))
      : null;
  if (v == null) {
    return (
      <p className={cn("text-[10px] text-zinc-400", className)}>اطمینان: —</p>
    );
  }
  return (
    <div className={cn("space-y-0.5", className)}>
      <div className="flex justify-between text-[10px] text-zinc-500">
        <span>اطمینان</span>
        <span>{v}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-violet-600 dark:bg-violet-400"
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}
