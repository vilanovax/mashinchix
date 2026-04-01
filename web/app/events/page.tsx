import { Suspense } from "react";
import { EventsView } from "./events-view";
import { CardSkeleton } from "@/components/ui/skeleton";
import { RequireAuth } from "@/components/auth/require-auth";

function Fallback() {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <CardSkeleton />
      </div>
    </div>
  );
}

export default function EventsPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<Fallback />}>
        <EventsView />
      </Suspense>
    </RequireAuth>
  );
}
