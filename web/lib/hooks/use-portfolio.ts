"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function usePortfolioState(userId: string) {
  return useQuery({
    queryKey: ["portfolio-state", userId],
    queryFn: () => apiFetch(`/portfolio/state/${encodeURIComponent(userId)}`),
    enabled: !!userId,
  });
}

export function usePortfolioPerformance(userId: string) {
  return useQuery({
    queryKey: ["portfolio-performance", userId],
    queryFn: () => apiFetch(`/portfolio/performance/${encodeURIComponent(userId)}`),
    enabled: !!userId,
  });
}

export function usePortfolioPositions(userId: string) {
  return useQuery({
    queryKey: ["portfolio-positions", userId],
    queryFn: () => apiFetch(`/portfolio/positions/${encodeURIComponent(userId)}`),
    enabled: !!userId,
  });
}

export function usePortfolioHistory(userId: string, take = 60) {
  return useQuery({
    queryKey: ["portfolio-history", userId, take],
    queryFn: () =>
      apiFetch(
        `/portfolio/history/${encodeURIComponent(userId)}?take=${take}`,
      ),
    enabled: !!userId,
  });
}

export function usePortfolioTransactions(userId: string, take = 80) {
  return useQuery({
    queryKey: ["portfolio-transactions", userId, take],
    queryFn: () =>
      apiFetch(
        `/portfolio/transactions/${encodeURIComponent(userId)}?take=${take}`,
      ),
    enabled: !!userId,
  });
}

export function usePortfolioValue(userId: string) {
  return useQuery({
    queryKey: ["portfolio-value", userId],
    queryFn: () => apiFetch(`/portfolio/value/${encodeURIComponent(userId)}`),
    enabled: !!userId,
  });
}
