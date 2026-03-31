import { Suspense } from "react";
import { AssetsView } from "./assets-view";
import { CardSkeleton } from "@/components/ui/skeleton";

function AssetsFallback() {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <CardSkeleton />
    </div>
  );
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<AssetsFallback />}>
      <AssetsView />
    </Suspense>
  );
}
