import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function ActionButton({
  className,
  children,
  variant = "secondary",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
        variant === "primary" &&
          "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
        variant === "secondary" &&
          "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
        variant === "ghost" && "text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
