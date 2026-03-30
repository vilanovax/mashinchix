import { Injectable } from '@nestjs/common';
import { Prisma, RecommendationSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RECOMMENDATION_MODEL_VERSION } from './recommendation-model.constants';

@Injectable()
export class RecommendationSessionService {
  constructor(private readonly prisma: PrismaService) {}

  /** ثبت غیرقابل‌ویرایش session + نتایج (برای analytics و بازخورد) */
  async createSessionWithResults(input: {
    userId: string | null;
    clientSessionId: string;
    source: RecommendationSource;
    requestPayload: unknown;
    results: Array<{
      carId: string;
      rank: number;
      finalScore: number;
      explanation: unknown;
    }>;
    /** پیش‌فرض v2؛ برای v3 مقدار RECOMMENDATION_MODEL_VERSION_V3 بفرستید */
    modelVersion?: string;
  }): Promise<string> {
    const session = await this.prisma.recommendationSession.create({
      data: {
        userId: input.userId ?? undefined,
        sessionId: input.clientSessionId,
        source: input.source,
        requestPayload: input.requestPayload as Prisma.InputJsonValue,
        modelVersion:
          input.modelVersion?.trim() || RECOMMENDATION_MODEL_VERSION,
        results: {
          create: input.results.map((r) => ({
            carId: r.carId,
            rank: r.rank,
            finalScore: r.finalScore,
            explanation:
              r.explanation == null
                ? undefined
                : (r.explanation as Prisma.InputJsonValue),
          })),
        },
      },
    });
    return session.id;
  }
}
