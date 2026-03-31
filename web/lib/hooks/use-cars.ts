"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/** لیست خودروها — internal API (بدون کلید عمومی) */
export function useCarsList(limit = 24) {
  return useQuery({
    queryKey: ["cars", "list", limit],
    queryFn: () => apiFetch(`/cars?limit=${limit}`),
  });
}

export function useCarDetail(id: string) {
  return useQuery({
    queryKey: ["cars", id],
    queryFn: () => apiFetch(`/cars/${encodeURIComponent(id)}`),
    enabled: !!id,
  });
}

/** مسیرهای public — در صورت نیاز به کلید در env */
export function usePublicCarIntelligence(id: string) {
  return useQuery({
    queryKey: ["public", "cars", id, "intelligence"],
    queryFn: () => apiFetch(`/public/cars/${encodeURIComponent(id)}/intelligence`),
    enabled: !!id,
  });
}

export function usePublicCarPrediction(id: string) {
  return useQuery({
    queryKey: ["public", "cars", id, "prediction"],
    queryFn: () => apiFetch(`/public/cars/${encodeURIComponent(id)}/prediction`),
    enabled: !!id,
  });
}

export function usePublicCarSignals(id: string) {
  return useQuery({
    queryKey: ["public", "cars", id, "signals"],
    queryFn: () => apiFetch(`/public/cars/${encodeURIComponent(id)}/signals`),
    enabled: !!id,
  });
}
