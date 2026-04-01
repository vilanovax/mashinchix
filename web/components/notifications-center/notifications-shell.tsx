"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";

export function NotificationsShell({
  title,
  sidebar,
  children,
}: {
  title: string;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppShell title={title}>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] lg:items-start">
          <aside className="order-first space-y-4 lg:sticky lg:top-4">{sidebar}</aside>
          <div className="min-w-0 space-y-6">{children}</div>
        </div>
      </div>
    </AppShell>
  );
}
