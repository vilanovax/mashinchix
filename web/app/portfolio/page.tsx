import { Suspense } from "react";
import { PortfolioView } from "./portfolio-view";
import { CardSkeleton } from "@/components/ui/skeleton";
import { RequireAuth } from "@/components/auth/require-auth";

function PortfolioFallback() {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="flex-1 p-6">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<PortfolioFallback />}>
        <PortfolioView />
      </Suspense>
    </RequireAuth>
  );
}
