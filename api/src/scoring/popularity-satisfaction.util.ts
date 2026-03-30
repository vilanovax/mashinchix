import { IntelligenceDimension } from './feature-nlp-aggregate';

export function computePopularityScore(input: {
  adsCount: number;
  demandScore: number | null;
  reviewsCount: number;
}): number {
  const adsNorm = Math.min(100, Math.log10(input.adsCount + 1) * 26);
  const dem = input.demandScore ?? 50;
  const revNorm = Math.min(100, input.reviewsCount * 5);
  return (
    Math.round((0.38 * adsNorm + 0.35 * dem + 0.27 * revNorm) * 10) /
    10
  );
}

/** میانگین وزن‌دار ابعاد مرتبط با «رضایت مالک» از NLP */
export function computeOwnerSatisfactionScore(
  nlp: Record<IntelligenceDimension, number | null>,
): number {
  const weights: [IntelligenceDimension, number][] = [
    ['comfort', 0.25],
    ['reliability', 0.25],
    ['economy', 0.15],
    ['ownership', 0.2],
    ['performance', 0.15],
  ];
  let sum = 0;
  let w = 0;
  for (const [k, wt] of weights) {
    const v = nlp[k];
    if (v != null) {
      sum += v * wt;
      w += wt;
    }
  }
  if (w === 0) return 52;
  return Math.round((sum / w) * 10) / 10;
}
