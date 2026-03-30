import { Body, Controller, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeAliasPhrase } from '../common/text-normalize';
import { NlpPipelineService } from '../nlp/nlp-pipeline.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewsIngestionService } from '../reviews/reviews-ingestion.service';
import { CreateCarAliasDto } from './dto/create-car-alias.dto';
import { IngestReviewsDto } from './dto/ingest-reviews.dto';

@Controller('admin')
export class DataQualityAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewsIngestion: ReviewsIngestionService,
    private readonly nlp: NlpPipelineService,
    private readonly config: ConfigService,
  ) {}

  private guard(): boolean {
    return this.config.get<string>('ALLOW_ADMIN_DATA_QUALITY') === 'true';
  }

  @Post('car-aliases')
  async createAlias(@Body() dto: CreateCarAliasDto) {
    if (!this.guard()) {
      return {
        ok: false,
        error: 'Set ALLOW_ADMIN_DATA_QUALITY=true',
      };
    }
    const normalized = normalizeAliasPhrase(dto.alias);
    const weight = dto.weight ?? 0;

    const row = await this.prisma.carAlias.upsert({
      where: { normalized },
      create: {
        carId: dto.carId,
        alias: dto.alias,
        normalized,
        sourceFilter: dto.sourceFilter,
        weight,
        isActive: dto.isActive ?? true,
      },
      update: {
        carId: dto.carId,
        alias: dto.alias,
        sourceFilter: dto.sourceFilter ?? null,
        weight,
        isActive: dto.isActive ?? true,
      },
    });
    return { ok: true, alias: row };
  }

  @Post('reviews/ingest')
  async ingestReviews(@Body() dto: IngestReviewsDto) {
    if (!this.guard()) {
      return { ok: false, error: 'Set ALLOW_ADMIN_DATA_QUALITY=true' };
    }
    const result = await this.reviewsIngestion.ingestBatch(
      dto.carId,
      dto.source,
      dto.items,
    );
    return { ok: true, ...result };
  }

  @Post('cars/:carId/nlp/extract-features')
  async extractFeatures(@Param('carId') carId: string) {
    if (!this.guard()) {
      return { ok: false, error: 'Set ALLOW_ADMIN_DATA_QUALITY=true' };
    }
    const result = await this.nlp.runStubExtractionForCar(carId);
    return { ok: true, ...result };
  }
}
