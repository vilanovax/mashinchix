import { Injectable } from '@nestjs/common';
import {
  DecisionMarketOutlook,
  DecisionPortfolioAction,
  RiskLevel,
} from '@prisma/client';

@Injectable()
export class AdvisorNarrativeService {
  build(params: {
    marketCycle?: string | null;
    marketOutlook: DecisionMarketOutlook;
    riskLevel: RiskLevel;
    portfolioDecision: DecisionPortfolioAction;
    activeAlerts: number;
    opportunityCount: number;
    userAlertCount: number;
    topActionLabel?: string;
  }) {
    const marketFa = this.marketFa(params.marketCycle, params.marketOutlook);
    const riskFa = this.riskFa(params.riskLevel);
    const portFa = this.portfolioFa(params.portfolioDecision);
    const parts = [marketFa, riskFa, portFa];
    if (params.activeAlerts > 20) {
      parts.push(
        `حجم هشدارهای فعال بازار بالاست (${params.activeAlerts})؛ ورود تدریجی و کنترل ریسک توصیه می‌شود.`,
      );
    }
    if (params.userAlertCount > 0) {
      parts.push(
        `${params.userAlertCount} رویداد اخیر مرتبط با سبدی شما ثبت شده است.`,
      );
    }
    if (params.opportunityCount > 0) {
      parts.push(
        `${params.opportunityCount} فرصت سرمایه‌گذاری در نمای بازار شناسایی شده است.`,
      );
    }
    if (params.topActionLabel) {
      parts.push(`بهترین اقدام پیشنهادی امروز: ${params.topActionLabel}.`);
    }
    parts.push(
      'پیش‌بینی می‌شود با اجرای منظم این اقدامات، بازده مورد انتظار بهتر و ریسک کنترل‌شده‌تر شود.',
    );
    const briefing = parts.join('\n');
    const summaryFa = [
      marketFa,
      params.topActionLabel ? `پیشنهاد اصلی: ${params.topActionLabel}.` : '',
    ]
      .filter(Boolean)
      .join(' ');
    const summaryEn = this.englishSummary({
      marketOutlook: params.marketOutlook,
      topActionLabel: params.topActionLabel,
    });
    return { briefing, summaryFa, summaryEn };
  }

  private marketFa(cycle?: string | null, outlook?: DecisionMarketOutlook) {
    if (outlook === DecisionMarketOutlook.BEAR) {
      return 'چشم‌انداز بازار محتاط تا منفی ارزیابی می‌شود.';
    }
    if (outlook === DecisionMarketOutlook.SIDEWAYS) {
      return 'بازار در مسیر خنثی است و انتظار برای سیگنال قوی‌تر منطقی است.';
    }
    const c = (cycle ?? '').toUpperCase();
    if (c.includes('BEAR')) {
      return 'چرخهٔ بازار نشانه‌های فاز ضعیف‌تر را دارد.';
    }
    if (c.includes('BULL') || outlook === DecisionMarketOutlook.BULL) {
      return 'بازار در وضعیت صعودی محتاط قرار دارد.';
    }
    return 'ترکیبی از فرصت‌ها و نوسان کوتاه‌مدت در بازار دیده می‌شود.';
  }

  private riskFa(rl: RiskLevel) {
    if (rl === RiskLevel.HIGH) {
      return 'ریسک هدف و سناریوهای بدبینانه در سطح بالاتر مدل‌سازی شده است.';
    }
    if (rl === RiskLevel.LOW) {
      return 'ریسک هدف نزدیک به محدودهٔ محافظه‌کارانه است.';
    }
    return 'ریسک بازار و سبدی در سطح متوسط قرار دارد.';
  }

  private portfolioFa(pd: DecisionPortfolioAction) {
    switch (pd) {
      case DecisionPortfolioAction.REBALANCE:
        return 'سبد از نظر وزن نیاز به ری‌بالانس دارد.';
      case DecisionPortfolioAction.REDUCE_RISK:
        return 'سبد نیاز به کاهش موقعیت پرریسک یا نوسان دارد.';
      case DecisionPortfolioAction.INCREASE_RISK:
        return 'با توجه به پروفایل، افزایش کنترل‌شده ریسک قابل بحث است.';
      default:
        return 'سبد در محدودهٔ قابل قبول نسبت به هدف است.';
    }
  }

  private englishSummary(p: {
    marketOutlook: DecisionMarketOutlook;
    topActionLabel?: string;
  }) {
    let m: string;
    if (p.marketOutlook === DecisionMarketOutlook.BEAR) {
      m = 'Market outlook is cautious to bearish.';
    } else if (p.marketOutlook === DecisionMarketOutlook.SIDEWAYS) {
      m = 'Market is sideways; clarity may improve with time.';
    } else {
      m = 'Market is in a cautious bull phase.';
    }
    const t = p.topActionLabel ? ` Recommended action: ${p.topActionLabel}.` : '';
    return `${m}${t}`;
  }
}
