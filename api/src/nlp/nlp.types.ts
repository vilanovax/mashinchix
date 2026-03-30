/** خروجی مرحلهٔ NLP / استخراج ویژگی (قبل از persist در CarFeatureScores) */
export type ExtractedFeatureMention = {
  feature: string;
  polarity: 'positive' | 'negative' | 'neutral';
  /** فاصلهٔ اطمینان ۰–۱ برای مدل واقعی؛ در stub اختیاری */
  score?: number;
};

export type NlpPipelineBatchResult = {
  carId: string;
  reviewsProcessed: number;
  featuresUpserted: number;
};
