import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type ReviewIngestItemDto = {
  text: string;
  externalId?: string;
  title?: string;
  rawMetadata?: Record<string, unknown>;
};

@Injectable()
export class ReviewsIngestionService {
  constructor(private readonly prisma: PrismaService) {}

  static hashContent(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }

  async ingestBatch(
    carId: string,
    source: string,
    items: ReviewIngestItemDto[],
  ): Promise<{ createdOrUpdated: number }> {
    const car = await this.prisma.car.findUnique({ where: { id: carId } });
    if (!car) throw new NotFoundException(`Car ${carId} not found`);

    let createdOrUpdated = 0;
    for (const item of items) {
      if (!item.text?.trim()) continue;
      const contentHash = ReviewsIngestionService.hashContent(item.text);

      await this.prisma.carReviewsRaw.upsert({
        where: {
          carId_contentHash: {
            carId,
            contentHash,
          },
        },
        create: {
          carId,
          source,
          text: item.text,
          externalId: item.externalId,
          title: item.title,
          rawMetadata: item.rawMetadata as Prisma.InputJsonValue | undefined,
          contentHash,
        },
        update: {
          externalId: item.externalId,
          title: item.title,
          rawMetadata: item.rawMetadata as Prisma.InputJsonValue | undefined,
          fetchedAt: new Date(),
        },
      });
      createdOrUpdated += 1;
    }

    return { createdOrUpdated };
  }
}
