import { apiFetch } from "@/lib/api";

export type RecommendV3Item = {
  rank: number;
  id: string;
  brand: string;
  model: string;
  year: number;
  recommendationFinalScore?: number;
  marketData?: { avgPrice?: number | null } | null;
  explanation?: {
    structured?: unknown;
    legacySummary?: string;
  };
};

export type RecommendV3Response = {
  engine: string;
  userId: string | null;
  budget: number;
  count: number;
  results: RecommendV3Item[];
  recommendations?: RecommendV3Item[];
};

export function postRecommendationsV3(body: {
  userId: string;
  limit?: number;
}): Promise<RecommendV3Response> {
  return apiFetch<RecommendV3Response>("/recommendations/v3", {
    method: "POST",
    body: JSON.stringify({
      userId: body.userId,
      limit: body.limit ?? 12,
    }),
  });
}
