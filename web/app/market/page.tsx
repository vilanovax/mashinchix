import { Suspense } from "react";
import { MarketView } from "./market-view";
import { CardSkeleton } from "@/components/ui/skeleton";

function MarketFallback() {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="flex-1 p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function MarketPage() {
  return (
    <Suspense fallback={<MarketFallback />}>
      <MarketView />
    </Suspense>
  );
}
