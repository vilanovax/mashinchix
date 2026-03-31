"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

/**
 * اولویت: ?userId= سپس NEXT_PUBLIC_DEFAULT_USER_ID
 */
export function useResolvedUserId(): string {
  const sp = useSearchParams();
  return useMemo(() => {
    const q = sp.get("userId")?.trim();
    const env = (process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? "").trim();
    return q || env || "";
  }, [sp]);
}
