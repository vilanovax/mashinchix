"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/** با JWT: GET /alerts — با userId اختیاری: مسیر قدیمی */
export function useUserTriggersAndNotifications(userId?: string, limit = 40) {
  const session = !userId;
  return useQuery({
    queryKey: ["alerts-pack", userId ?? "me", limit],
    queryFn: () =>
      session
        ? apiFetch(`/alerts?limit=${limit}`)
        : apiFetch(
            `/triggers/user/${encodeURIComponent(userId!)}?limit=${limit}`,
          ),
    enabled: session || !!userId,
  });
}

export function useMarketAlertsOverview(limit = 48) {
  return useQuery({
    queryKey: ["intelligence", "alerts", limit],
    queryFn: () => apiFetch(`/intelligence/alerts?limit=${limit}`),
  });
}

export function useAnalyticsAlerts(limit = 48) {
  return useQuery({
    queryKey: ["analytics", "alerts", limit],
    queryFn: () => apiFetch(`/analytics/alerts?limit=${limit}`),
  });
}
