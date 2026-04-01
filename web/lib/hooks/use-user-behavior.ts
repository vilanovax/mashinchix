"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useBehaviorProfile(userId?: string) {
  const session = !userId;
  return useQuery({
    queryKey: ["user", "behavior-profile", userId ?? "me"],
    queryFn: () =>
      session
        ? apiFetch(`/user/me/behavior-profile`)
        : apiFetch(`/user/behavior-profile/${encodeURIComponent(userId!)}`),
    enabled: session || !!userId,
  });
}

export function useUserPreferences(userId?: string) {
  const session = !userId;
  return useQuery({
    queryKey: ["user", "preferences", userId ?? "me"],
    queryFn: () =>
      session
        ? apiFetch(`/user/me/preferences`)
        : apiFetch(`/user/preferences/${encodeURIComponent(userId!)}`),
    enabled: session || !!userId,
  });
}

export function useUserRiskProfile(userId?: string) {
  const session = !userId;
  return useQuery({
    queryKey: ["user", "risk-profile", userId ?? "me"],
    queryFn: () =>
      session
        ? apiFetch(`/user/me/risk-profile`)
        : apiFetch(`/user/risk-profile/${encodeURIComponent(userId!)}`),
    enabled: session || !!userId,
  });
}
