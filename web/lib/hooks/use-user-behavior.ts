"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useBehaviorProfile(userId: string) {
  return useQuery({
    queryKey: ["user", "behavior-profile", userId],
    queryFn: () =>
      apiFetch(`/user/behavior-profile/${encodeURIComponent(userId)}`),
    enabled: !!userId,
  });
}

export function useUserPreferences(userId: string) {
  return useQuery({
    queryKey: ["user", "preferences", userId],
    queryFn: () => apiFetch(`/user/preferences/${encodeURIComponent(userId)}`),
    enabled: !!userId,
  });
}

export function useUserRiskProfile(userId: string) {
  return useQuery({
    queryKey: ["user", "risk-profile", userId],
    queryFn: () => apiFetch(`/user/risk-profile/${encodeURIComponent(userId)}`),
    enabled: !!userId,
  });
}
