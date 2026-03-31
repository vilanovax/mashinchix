"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/** رویدادها و نوتیفیکیشن‌های کاربر — معادل بخش «اعلان‌ها» */
export function useUserTriggersAndNotifications(userId: string, limit = 40) {
  return useQuery({
    queryKey: ["triggers", "user", userId, limit],
    queryFn: () =>
      apiFetch(
        `/triggers/user/${encodeURIComponent(userId)}?limit=${limit}`,
      ),
    enabled: !!userId,
  });
}

/** هشدارهای سطح بازار (intelligence) */
export function useMarketAlertsOverview(limit = 48) {
  return useQuery({
    queryKey: ["intelligence", "alerts", limit],
    queryFn: () => apiFetch(`/intelligence/alerts?limit=${limit}`),
  });
}

/** آنالیتیکس alerts (در صورت وجود داده) */
export function useAnalyticsAlerts(limit = 48) {
  return useQuery({
    queryKey: ["analytics", "alerts", limit],
    queryFn: () => apiFetch(`/analytics/alerts?limit=${limit}`),
  });
}
