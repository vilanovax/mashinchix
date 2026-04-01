import { Suspense } from "react";
import { AlertsView } from "./alerts-view";
import { CardSkeleton } from "@/components/ui/skeleton";
import { RequireAuth } from "@/components/auth/require-auth";

function AlertsFallback() {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="mx-auto max-w-3xl space-y-4 w-full">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

export default function AlertsPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<AlertsFallback />}>
        <AlertsView />
      </Suspense>
    </RequireAuth>
  );
}
