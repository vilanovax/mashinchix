"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useIntelligenceOpportunities(limit = 28) {
  return useQuery({
    queryKey: ["intelligence", "opportunities", limit],
    queryFn: () => apiFetch(`/intelligence/opportunities?limit=${limit}`),
  });
}

/** بدون userId: /me/strategy با JWT */
export function useIntelligenceStrategy(userId?: string) {
  const session = userId === undefined || userId === "";
  return useQuery({
    queryKey: ["intelligence", "strategy", userId ?? "me"],
    queryFn: () =>
      session
        ? apiFetch(`/me/strategy`)
        : apiFetch(
            `/intelligence/strategy?userId=${encodeURIComponent(userId!)}`,
          ),
  });
}

export function useIntelligenceDecision(userId?: string) {
  const session = userId === undefined || userId === "";
  return useQuery({
    queryKey: ["intelligence", "decision", userId ?? "me"],
    queryFn: () =>
      session
        ? apiFetch(`/me/decision`)
        : apiFetch(
            `/intelligence/decision?userId=${encodeURIComponent(userId!)}`,
          ),
  });
}

export function useIntelligenceOverview(userId?: string, persist = false) {
  const session = userId === undefined || userId === "";
  const params = new URLSearchParams();
  if (!session) params.set("userId", userId!);
  if (persist) params.set("persist", "true");
  const q = params.toString() ? `?${params}` : "";
  return useQuery({
    queryKey: ["intelligence", "overview", userId ?? "me", persist],
    queryFn: () => {
      if (session) {
        const p = persist ? "?persist=true" : "";
        return apiFetch(`/me/intelligence${p}`);
      }
      return apiFetch(`/intelligence/overview${q}`);
    },
  });
}

export function useIntelligenceRisk(userId?: string) {
  const session = userId === undefined || userId === "";
  return useQuery({
    queryKey: ["intelligence", "risk", userId ?? "me"],
    queryFn: () =>
      session
        ? apiFetch(`/me/risk`)
        : apiFetch(`/intelligence/risk?userId=${encodeURIComponent(userId!)}`),
  });
}
