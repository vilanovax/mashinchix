"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useAdvisorSummary() {
  return useQuery({
    queryKey: ["advisor", "summary", "me"],
    queryFn: () => apiFetch(`/advisor/summary`),
  });
}

export function useAdvisorHistory(limit = 30) {
  return useQuery({
    queryKey: ["advisor", "history", "me", limit],
    queryFn: () => apiFetch(`/advisor/history?limit=${limit}`),
  });
}

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
