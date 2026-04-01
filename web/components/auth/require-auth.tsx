"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "./auth-context";
import { CardSkeleton } from "@/components/ui/skeleton";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      const q = pathname ? `?from=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${q}`);
    }
  }, [status, router, pathname]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-8">
        <div className="w-full max-w-md space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return children;
}
