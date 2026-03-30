import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TrackEventDto } from './dto/track-event.dto';
import { RecommendationFeedbackService } from './recommendation-feedback.service';

@Injectable()
export class UserEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feedback: RecommendationFeedbackService,
  ) {}

  async trackEvent(dto: TrackEventDto): Promise<{ id: string }> {
    const event = await this.prisma.userEvent.create({
      data: {
        sessionId: dto.sessionId,
        userId: dto.userId,
        eventType: dto.eventType,
        carId: dto.carId,
        recommendationSessionId: dto.recommendationSessionId,
        metadata:
          dto.metadata == null
            ? undefined
            : (dto.metadata as Prisma.InputJsonValue),
      },
    });

    await this.feedback.applyFeedbackFromEvent({
      eventType: dto.eventType,
      carId: dto.carId,
      recommendationSessionId: dto.recommendationSessionId,
      metadata: dto.metadata,
    });

    return { id: event.id };
  }
}
