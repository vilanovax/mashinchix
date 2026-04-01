import { Suspense } from "react";
import { NotificationsView } from "./notifications-view";
import { CardSkeleton } from "@/components/ui/skeleton";
import { RequireAuth } from "@/components/auth/require-auth";

function Fallback() {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<Fallback />}>
        <NotificationsView />
      </Suspense>
    </RequireAuth>
  );
}
