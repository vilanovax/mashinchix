import { Suspense } from "react";
import { TodayView } from "./today-view";
import { CardSkeleton } from "@/components/ui/skeleton";

function TodayFallback() {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TodayPage() {
  return (
    <Suspense fallback={<TodayFallback />}>
      <TodayView />
    </Suspense>
  );
}
