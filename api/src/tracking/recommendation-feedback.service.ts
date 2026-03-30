import { Injectable } from '@nestjs/common';
import { UserEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecommendationFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  /** به‌روزرسانی هدفمند RecommendationResult بر اساس رویداد */
  async applyFeedbackFromEvent(input: {
    eventType: UserEventType;
    carId: string | null | undefined;
    recommendationSessionId: string | null | undefined;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    const meta = input.metadata ?? undefined;
    const sessionId =
      input.recommendationSessionId ??
      (typeof meta?.recommendationSessionId === 'string'
        ? meta.recommendationSessionId
        : null);

    const carId =
      input.carId ??
      (typeof meta?.carId === 'string' ? meta.carId : null);

    if (!sessionId || !carId) {
      return;
    }

    switch (input.eventType) {
      case UserEventType.RECOMMENDATION_CLICK:
        await this.patchResult(sessionId, carId, { wasClicked: true });
        break;
      case UserEventType.RECOMMENDATION_DISMISS:
        await this.patchResult(sessionId, carId, {
          wasDismissed: true,
        });
        break;
      case UserEventType.WISHLIST_ADD:
        await this.patchResult(sessionId, carId, { wasSaved: true });
        break;
      default:
        break;
    }
  }

  private async patchResult(
    recommendationSessionId: string,
    carId: string,
    data: { wasClicked?: boolean; wasSaved?: boolean; wasDismissed?: boolean },
  ): Promise<void> {
    await this.prisma.recommendationResult.updateMany({
      where: { recommendationSessionId, carId },
      data,
    });
  }
}
