import { ExtractedFeatureMention } from './nlp.types';

/** الگوهای سطح قواعد — جایگزین با مدل Python / OpenAI */
const RULES: {
  feature: string;
  positive: RegExp[];
  negative: RegExp[];
}[] = [
  {
    feature: 'economy',
    positive: [/مصرف\s*کم/, /کم‌سوخت/, /به\u200cصرفه/],
    negative: [/پرمصرف/, /مصرف\s*زیاد/],
  },
  {
    feature: 'comfort',
    positive: [/راحت/, /نرم/, /کابین\s*بی\s*صدا/],
    negative: [/ناسازگار/, /سفت/, /بدنه\s*عقب/],
  },
  {
    feature: 'performance',
    positive: [/شتاب\s*خوب/, /گشاد/, /اسپرت/],
    negative: [/کند/, /بی\s*رمق/],
  },
  {
    feature: 'reliability',
    positive: [/بی\u200cخطر/, /به\u200cدرد\s*نخور/, /بدون\s*خرابی/],
    negative: [/خرابی/, /ایست\s*کردن/, /گرمای\s*موتور/],
  },
  {
    feature: 'maintenance',
    positive: [/تعمیر\s*ارزان/, /قطعه\s*پیدا/, /سرویس\s*منطقی/],
    negative: [/تعمیر\s*گران/, /قطعه\s*ندار/],
  },
  {
    feature: 'prestige',
    positive: [/کلاس/, /لوکس/, /پرستیژ/, /برند/, /خاص/],
    negative: [/ارزان\s*قیمت/, /بدنه\s*ضعیف/, /بی\u200cکیفیت/],
  },
];

/** استخراج سطح قواعد — آمادهٔ جایگزینی با سرویس NLP بیرونی */
export function stubExtractFromPersianText(text: string): ExtractedFeatureMention[] {
  if (!text?.trim()) return [];
  const out: ExtractedFeatureMention[] = [];
  const t = text.trim();
  for (const rule of RULES) {
    let pos = 0;
    let neg = 0;
    for (const r of rule.positive) {
      if (r.test(t)) pos += 1;
    }
    for (const r of rule.negative) {
      if (r.test(t)) neg += 1;
    }
    if (pos > neg && pos > 0) {
      out.push({ feature: rule.feature, polarity: 'positive', score: 0.6 });
    } else if (neg > pos && neg > 0) {
      out.push({ feature: rule.feature, polarity: 'negative', score: 0.6 });
    }
  }
  return out;
}
