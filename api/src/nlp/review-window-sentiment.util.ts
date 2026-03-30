import { stubExtractFromPersianText } from './stub-feature-extractor';

/** امتیاز ۰–۱۰۰ از مجموع mentionهای مثبت/منفی در یک دسته از متن‌ها (stub قواعد) */
export function sentimentFromReviewTexts(texts: string[]): number | null {
  let pos = 0;
  let neg = 0;
  for (const text of texts) {
    if (!text?.trim()) continue;
    const mentions = stubExtractFromPersianText(text);
    for (const m of mentions) {
      if (m.polarity === 'positive') pos += 1;
      else if (m.polarity === 'negative') neg += 1;
    }
  }
  const t = pos + neg;
  if (t === 0) return null;
  return Math.max(0, Math.min(100, 50 + (50 * (pos - neg)) / t));
}
