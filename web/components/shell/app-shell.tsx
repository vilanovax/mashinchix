"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
function ShellBody({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AppSidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppTopbar title={title} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

function ShellFallback({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AppSidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-zinc-200/90 bg-white/85 px-4 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/75 sm:px-6">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {title}
          </h1>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<ShellFallback title={title}>{children}</ShellFallback>}>
      <ShellBody title={title}>{children}</ShellBody>
    </Suspense>
  );
}
