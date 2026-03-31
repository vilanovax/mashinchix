"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useMarketOverview() {
  return useQuery({
    queryKey: ["intelligence", "market"],
    queryFn: () => apiFetch("/intelligence/market"),
  });
}

export function useAnalyticsMarketCycles() {
  return useQuery({
    queryKey: ["analytics", "market", "cycles"],
    queryFn: () => apiFetch("/analytics/market/cycles"),
  });
}

export function useAnalyticsMarketMomentum() {
  return useQuery({
    queryKey: ["analytics", "market", "momentum"],
    queryFn: () => apiFetch("/analytics/market/momentum"),
  });
}

export function useAnalyticsLiquidityTrends() {
  return useQuery({
    queryKey: ["analytics", "market", "liquidity-trends"],
    queryFn: () => apiFetch("/analytics/market/liquidity-trends"),
  });
}
