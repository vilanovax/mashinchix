import { Injectable } from '@nestjs/common';
import { AdvisorExplanationService } from '../decision/advisor-explanation.service';
import type { DecisionSummaryPayload } from '../decision/decision.types';

@Injectable()
export class IntelligenceBriefingService {
  constructor(private readonly advisorText: AdvisorExplanationService) {}

  /** خلاصهٔ روزانهٔ قابل انتشار برای کلاینت‌ها */
  buildUnifiedBriefing(params: {
    decision: DecisionSummaryPayload;
    strategyPrimaryTitle?: string | null;
    activeAlertsCount?: number | null;
  }): string {
    const parts: string[] = [this.advisorText.buildNarrative(params.decision)];
    if (params.strategyPrimaryTitle) {
      parts.push(`رویکرد تاکتیکی پیشنهادی: ${params.strategyPrimaryTitle}.`);
    }
    const n = params.activeAlertsCount ?? 0;
    if (n > 0) {
      parts.push(`هم‌اکنون ${n} هشدار فعال در بازار ثبت شده است؛ پیش از اقدام، آن‌ها را مرور کنید.`);
    }
    return parts.join(' ');
  }

  englishMicroBrief(d: DecisionSummaryPayload): string {
    return this.advisorText.buildShortEnglish(d);
  }
}
