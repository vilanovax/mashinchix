import { Injectable } from '@nestjs/common';
import { AdaptiveRuntimeConfigService } from '../adaptive/adaptive-runtime-config.service';
import { UserBehaviorService } from '../user-behavior/user-behavior.service';

@Injectable()
export class AdvisorPriorityService {
  constructor(
    private readonly runtime: AdaptiveRuntimeConfigService,
    private readonly behavior: UserBehaviorService,
  ) {}

  /** وزن تطبیقی؛ با اعتماد رفتاری کاربر (پروفایل) تقویت/تضعیف می‌شود. */
  async adaptiveWeight(userId?: string): Promise<number> {
    const [scoring, decConf] = await Promise.all([
      this.runtime.getScoringWeights(),
      this.runtime.getDecisionConfidenceWeights(),
    ]);
    const scale = decConf.scale ?? 1;
    const risk = scoring.risk ?? 1;
    let blend = (scale + (2 - Math.min(2, risk))) / 2;
    blend = Math.min(1.35, Math.max(0.55, blend));
    if (userId) {
      const prof = await this.behavior.getProfileRow(userId);
      const t = prof?.confidenceTrust;
      const o = prof?.overrideRate;
      if (typeof t === 'number') {
        blend *= Math.min(1.22, Math.max(0.68, 0.72 + 0.38 * t));
      }
      if (typeof o === 'number' && o > 0.28) {
        blend *= Math.max(0.72, 1 - 0.35 * (o - 0.28));
      }
    }
    return Math.min(1.45, Math.max(0.5, blend));
  }

  private clamp01(x: number, floor = 0.38): number {
    return Math.min(1, Math.max(floor, x));
  }

  /**
   * priority = confidence × impact × urgency × riskReduction × opportunity × adaptive
   * خروجی نرمال‌شده بین ۰ و ۱ برای مرتب‌سازی.
   */
  normalizedPriority(input: {
    confidence: number;
    impactScore: number;
    urgency: number;
    riskReduction: number;
    opportunityScore: number;
    adaptiveWeight: number;
  }): number {
    const c = this.clamp01(input.confidence / 100, 0.22);
    const raw =
      c *
      this.clamp01(input.impactScore) *
      this.clamp01(input.urgency) *
      this.clamp01(input.riskReduction) *
      this.clamp01(input.opportunityScore) *
      input.adaptiveWeight;
    return Math.min(1, Math.max(0, Math.pow(raw, 0.42)));
  }
}
