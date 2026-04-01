"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/** اگر userId خالی باشد مسیرهای نشست (JWT) استفاده می‌شود */
export function usePortfolioState(userId?: string) {
  const session = !userId;
  return useQuery({
    queryKey: ["portfolio-state", userId ?? "me"],
    queryFn: () =>
      session
        ? apiFetch(`/portfolio/state`)
        : apiFetch(`/portfolio/state/${encodeURIComponent(userId!)}`),
    enabled: session || !!userId,
  });
}

export function usePortfolioPerformance(userId?: string) {
  const session = !userId;
  return useQuery({
    queryKey: ["portfolio-performance", userId ?? "me"],
    queryFn: () =>
      session
        ? apiFetch(`/portfolio/performance`)
        : apiFetch(`/portfolio/performance/${encodeURIComponent(userId!)}`),
    enabled: session || !!userId,
  });
}

export function usePortfolioPositions(userId?: string) {
  const session = !userId;
  return useQuery({
    queryKey: ["portfolio-positions", userId ?? "me"],
    queryFn: () =>
      session
        ? apiFetch(`/portfolio/positions`)
        : apiFetch(`/portfolio/positions/${encodeURIComponent(userId!)}`),
    enabled: session || !!userId,
  });
}

export function usePortfolioHistory(userId?: string, take = 60) {
  const session = !userId;
  return useQuery({
    queryKey: ["portfolio-history", userId ?? "me", take],
    queryFn: () =>
      session
        ? apiFetch(`/portfolio/history?take=${take}`)
        : apiFetch(
            `/portfolio/history/${encodeURIComponent(userId!)}?take=${take}`,
          ),
    enabled: session || !!userId,
  });
}

export function usePortfolioTransactions(userId?: string, take = 80) {
  const session = !userId;
  return useQuery({
    queryKey: ["portfolio-transactions", userId ?? "me", take],
    queryFn: () =>
      session
        ? apiFetch(`/portfolio/transactions?take=${take}`)
        : apiFetch(
            `/portfolio/transactions/${encodeURIComponent(userId!)}?take=${take}`,
          ),
    enabled: session || !!userId,
  });
}

export function usePortfolioValue(userId?: string) {
  const session = !userId;
  return useQuery({
    queryKey: ["portfolio-value", userId ?? "me"],
    queryFn: () =>
      session
        ? apiFetch(`/portfolio/value`)
        : apiFetch(`/portfolio/value/${encodeURIComponent(userId!)}`),
    enabled: session || !!userId,
  });
}
