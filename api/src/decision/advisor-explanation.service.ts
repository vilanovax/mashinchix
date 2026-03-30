import { Injectable } from '@nestjs/common';
import type { DecisionSummaryPayload } from './decision.types';

@Injectable()
export class AdvisorExplanationService {
  /** متن روان فارسی برای کاربر نهایی */
  buildNarrative(d: DecisionSummaryPayload): string {
    const parts: string[] = [];

    const outlookFa =
      d.marketOutlook === 'BULL'
        ? 'فاز گاوی'
        : d.marketOutlook === 'BEAR'
          ? 'فاز خرسی'
          : 'رنج یا بی‌تصمیمی نسبی';

    parts.push(
      `بازار از منظر چرخه و شاخص سگمنت‌ها در وضعیت «${outlookFa}» قرار دارد.`,
    );

    const md = d.marketDecision;
    if (md === 'BUY')
      parts.push(
        'پیشنهاد اقدام در سطح بازار: ورود تدریجی به خرید با رعایت تنوع سگمنتی منطقی است.',
      );
    else if (md === 'WAIT' || md === 'CAUTIOUS')
      parts.push(
        'پیشنهاد اقدام: احتیاط یا صبر — تا زمانی که سیگنال‌ها یک‌دست‌تر شوند بهتر است عجله نکنید.',
      );
    else if (md === 'SELL')
      parts.push(
        'سیگنال کلی متأثر از فشار فروش یا ریسک بالاست؛ نگه‌داری بدون برنامهٔ خروج توصیه نمی‌شود.',
      );
    else parts.push('در سطح بازار، نگه‌داری موقعیت‌های فعلی با پایش نزدیک منطقی است.');

    const strat =
      d.strategyDecision === 'MOMENTUM'
        ? 'مومنتوم'
        : d.strategyDecision === 'LOW_RISK'
          ? 'کم‌ریسک'
          : d.strategyDecision === 'SEGMENT_ROTATION'
            ? 'چرخش سگمنت'
            : d.strategyDecision === 'CASH'
              ? 'نقد یا بسیار محتاط'
              : 'متعادل';
    parts.push(`استراتژی پیشنهادی سیستم در این فاز: ${strat}.`);

    if (d.segmentRecommendation.length)
      parts.push(
        `سگمنت‌های برتر فعلی: ${d.segmentRecommendation.join('، ')}.`,
      );
    if (d.avoidSegments.length)
      parts.push(`سگمنت‌های پرریسک‌تر یا ضعیف‌تر: ${d.avoidSegments.join('، ')}.`);

    const rk =
      d.riskLevel === 'LOW'
        ? 'پایین'
        : d.riskLevel === 'HIGH'
          ? 'بالا'
          : 'متوسط';
    parts.push(`سطح ریسک تلفیقی که موتور تشخیص داده: ${rk}.`);
    parts.push(
      `اطمینان مدل (۰–۱۰۰): حدود ${d.confidenceScore.toFixed(0)} — هرچه بالاتر، هم‌جهتی بیشتر بین سیگنال‌ها و دادهٔ تاریخی.`,
    );

    if (d.keyFactors.length)
      parts.push(`عوامل کلیدی: ${d.keyFactors.slice(0, 6).join('؛ ')}.`);
    if (d.warnings.length)
      parts.push(`هشدارها: ${d.warnings.slice(0, 5).join('؛ ')}.`);

    return parts.join(' ');
  }

  /** پاراگراف کوتاه انگلیسی (در صورت نیاز کلاینت) */
  buildShortEnglish(d: DecisionSummaryPayload): string {
    return (
      `Market outlook: ${d.marketOutlook}. Action: ${d.marketDecision}. ` +
      `Portfolio: ${d.portfolioDecision}. Strategy: ${d.strategyDecision}. ` +
      `Risk: ${d.riskLevel}. Confidence: ${d.confidenceScore.toFixed(0)}.`
    );
  }
}
