import { cn } from "@/lib/cn";

export type SeverityLevel = "HIGH" | "MEDIUM" | "LOW";

const LABEL: Record<SeverityLevel, string> = {
  HIGH: "بالا",
  MEDIUM: "متوسط",
  LOW: "پایین",
};

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        severity === "HIGH" &&
          "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200",
        severity === "MEDIUM" &&
          "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
        severity === "LOW" &&
          "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
      )}
    >
      {LABEL[severity]}
    </span>
  );
}
