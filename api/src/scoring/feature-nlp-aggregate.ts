import { CarFeatureScores } from '@prisma/client';

/** بعدهایی که مستقیماً از NLP (CarFeatureScores.feature) پر می‌شوند */
export const NLP_FEATURE_TO_DIMENSION: Record<
  string,
  IntelligenceDimension
> = {
  performance: 'performance',
  comfort: 'comfort',
  economy: 'economy',
  reliability: 'reliability',
  maintenance: 'ownership',
  prestige: 'prestige',
};

export type IntelligenceDimension =
  | 'performance'
  | 'comfort'
  | 'economy'
  | 'reliability'
  | 'ownership'
  | 'prestige';

/** امتیاز ۰–۱۰۰ از یک ردیف CarFeatureScores */
export function scoreFromFeatureRow(row: CarFeatureScores): number {
  if (row.score != null && Number.isFinite(row.score)) {
    return Math.max(0, Math.min(100, row.score));
  }
  const p = row.positiveCount;
  const n = row.negativeCount;
  const t = p + n;
  if (t === 0) return 50;
  return Math.max(0, Math.min(100, 50 + (50 * (p - n)) / t));
}

/**
 * میانگین وزن‌دار بر اساس حجم ذکر (positive+negative) برای پایداری بیشتر از فقط میانگین ساده.
 */
export function aggregateNlpByDimension(
  rows: CarFeatureScores[],
): Record<IntelligenceDimension, number | null> {
  const buckets: Record<
    IntelligenceDimension,
    { sum: number; w: number }
  > = {
    performance: { sum: 0, w: 0 },
    comfort: { sum: 0, w: 0 },
    economy: { sum: 0, w: 0 },
    reliability: { sum: 0, w: 0 },
    ownership: { sum: 0, w: 0 },
    prestige: { sum: 0, w: 0 },
  };

  for (const row of rows) {
    const dim = NLP_FEATURE_TO_DIMENSION[row.feature];
    if (!dim) continue;
    const s = scoreFromFeatureRow(row);
    const weight = Math.max(1, row.positiveCount + row.negativeCount);
    const b = buckets[dim];
    b.sum += s * weight;
    b.w += weight;
  }

  const out = {} as Record<IntelligenceDimension, number | null>;
  (Object.keys(buckets) as IntelligenceDimension[]).forEach((k) => {
    const { sum, w } = buckets[k];
    out[k] = w > 0 ? Math.round((sum / w) * 10) / 10 : null;
  });
  return out;
}
