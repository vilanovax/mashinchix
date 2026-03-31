"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV } from "@/lib/nav";
import { cn } from "@/lib/cn";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-s border-zinc-200/90 bg-white/95 dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800">
        <Link href="/dashboard" className="block font-semibold text-zinc-900 dark:text-zinc-50">
          Mashinchi
        </Link>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          مشاور سرمایه‌گذاری خودرو
        </p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {PRIMARY_NAV.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard" || pathname === "/"
              : pathname === item.href ||
                pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-100 p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <Link href="/assistant" className="text-violet-600 hover:underline dark:text-violet-400">
          دستیار انتخاب خودرو
        </Link>
      </div>
    </aside>
  );
}
