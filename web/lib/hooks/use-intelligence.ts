"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useIntelligenceOpportunities(limit = 28) {
  return useQuery({
    queryKey: ["intelligence", "opportunities", limit],
    queryFn: () => apiFetch(`/intelligence/opportunities?limit=${limit}`),
  });
}

export function useIntelligenceStrategy(userId?: string) {
  const q = userId
    ? `?userId=${encodeURIComponent(userId)}`
    : "";
  return useQuery({
    queryKey: ["intelligence", "strategy", userId ?? ""],
    queryFn: () => apiFetch(`/intelligence/strategy${q}`),
  });
}

export function useIntelligenceDecision(userId?: string) {
  const q = userId
    ? `?userId=${encodeURIComponent(userId)}`
    : "";
  return useQuery({
    queryKey: ["intelligence", "decision", userId ?? ""],
    queryFn: () => apiFetch(`/intelligence/decision${q}`),
  });
}

export function useIntelligenceOverview(userId?: string, persist = false) {
  const params = new URLSearchParams();
  if (userId) params.set("userId", userId);
  if (persist) params.set("persist", "true");
  const q = params.toString() ? `?${params}` : "";
  return useQuery({
    queryKey: ["intelligence", "overview", userId ?? "", persist],
    queryFn: () => apiFetch(`/intelligence/overview${q}`),
  });
}

export function useIntelligenceRisk(userId?: string) {
  const q = userId
    ? `?userId=${encodeURIComponent(userId)}`
    : "";
  return useQuery({
    queryKey: ["intelligence", "risk", userId ?? ""],
    queryFn: () => apiFetch(`/intelligence/risk${q}`),
  });
}
