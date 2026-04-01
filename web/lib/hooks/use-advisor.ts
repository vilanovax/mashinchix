"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useTodayAdvisor(userId?: string, persist = false) {
  const q = persist ? "?persist=true" : "";
  const session = !userId;
  return useQuery({
    queryKey: ["advisor", "today", userId ?? "me", persist],
    queryFn: () =>
      session
        ? apiFetch(`/advisor/today${q}`)
        : apiFetch(`/advisor/today/${encodeURIComponent(userId!)}${q}`),
    enabled: session || !!userId,
  });
}
