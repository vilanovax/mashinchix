import { Suspense } from "react";
import { DashboardView } from "./dashboard-view";
import { CardSkeleton } from "@/components/ui/skeleton";
import { RequireAuth } from "@/components/auth/require-auth";

function DashboardFallback() {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="flex-1 p-6">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<DashboardFallback />}>
        <DashboardView />
      </Suspense>
    </RequireAuth>
  );
}
