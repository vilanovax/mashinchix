import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  className,
  tone = "neutral",
}: {
  value: number;
  className?: string;
  tone?: "neutral" | "risk" | "confidence";
}) {
  const v = Math.min(100, Math.max(0, value));
  const bar =
    tone === "risk"
      ? "bg-rose-500"
      : tone === "confidence"
        ? "bg-emerald-500"
        : "bg-sky-500";
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all", bar)}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
