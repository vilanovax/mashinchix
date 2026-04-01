"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useAuth } from "@/components/auth/auth-context";

/**
 * برای هدر و مسیرهای قدیمی: اولویت ?userId= (بازجسته) سپس کاربر احرازشده.
 */
export function useResolvedUserId(): string {
  const sp = useSearchParams();
  const { user, status } = useAuth();
  return useMemo(() => {
    const q = sp.get("userId")?.trim();
    if (q) return q;
    if (status === "authenticated" && user?.id) return user.id;
    const env = (process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? "").trim();
    return env || "";
  }, [sp, user?.id, status]);
}

/** فقط برای دیتای نشست JWT: اگر ?userId= باشد همان (مسیرهای پارامتریک قدیمی)، وگره undefined */
export function useSessionOrDevUserId(): string | undefined {
  const sp = useSearchParams();
  return useMemo(() => {
    const q = sp.get("userId")?.trim();
    return q || undefined;
  }, [sp]);
}
