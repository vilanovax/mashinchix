import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { stubExtractFromPersianText } from './stub-feature-extractor';
import { NlpPipelineBatchResult } from './nlp.types';

/**
 * خط NLP داخل Node: فعلاً rule-based stub؛
 * مرحلهٔ بعد: صف پیام به سرویس Python یا API مدل زبانی.
 */
@Injectable()
export class NlpPipelineService {
  private readonly logger = new Logger(NlpPipelineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * جمع‌بندی نظرات خام → شمارش مثبت/منفی هر ویژگی → upsert CarFeatureScores
   * (امتیاز نهایی ۰–۱۰۰ با فرمول ساده از اختلاف شمارش).
   */
  async runStubExtractionForCar(carId: string): Promise<NlpPipelineBatchResult> {
    const car = await this.prisma.car.findUnique({ where: { id: carId } });
    if (!car) {
      throw new NotFoundException(`Car ${carId} not found`);
    }

    const reviews = await this.prisma.carReviewsRaw.findMany({
      where: { carId },
      select: { text: true },
    });

    const tallies = new Map<
      string,
      { positive: number; negative: number }
    >();

    for (const r of reviews) {
      const mentions = stubExtractFromPersianText(r.text);
      for (const m of mentions) {
        if (!tallies.has(m.feature)) {
          tallies.set(m.feature, { positive: 0, negative: 0 });
        }
        const t = tallies.get(m.feature)!;
        if (m.polarity === 'positive') t.positive += 1;
        else if (m.polarity === 'negative') t.negative += 1;
      }
    }

    let featuresUpserted = 0;
    for (const [feature, { positive, negative }] of tallies) {
      const total = positive + negative;
      const score =
        total > 0
          ? Math.max(0, Math.min(100, 50 + 50 * ((positive - negative) / total)))
          : null;

      await this.prisma.carFeatureScores.upsert({
        where: { carId_feature: { carId, feature } },
        create: {
          carId,
          feature,
          positiveCount: positive,
          negativeCount: negative,
          score,
        },
        update: {
          positiveCount: positive,
          negativeCount: negative,
          score,
        },
      });
      featuresUpserted += 1;
    }

    this.logger.log(
      `NLP stub: car ${carId}, reviews=${reviews.length}, features=${featuresUpserted}`,
    );

    return {
      carId,
      reviewsProcessed: reviews.length,
      featuresUpserted,
    };
  }
}
