"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useTodayAdvisor(userId: string, persist = false) {
  const q = persist ? "?persist=true" : "";
  return useQuery({
    queryKey: ["advisor", "today", userId, persist],
    queryFn: () => apiFetch(`/advisor/today/${encodeURIComponent(userId)}${q}`),
    enabled: !!userId,
  });
}
