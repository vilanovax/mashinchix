import { RecommendationSource } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RecommendationWeightsDto } from './create-recommendation.dto';

/** وزن‌های v2 شامل ابعاد اضافه برای سرمایه‌گذاری و اعتماد اجتماعی */
export class RecommendationWeightsV2Dto extends RecommendationWeightsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  investment?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  popularity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ownerSatisfaction?: number;
}

export class RecommendV2Dto {
  /** شناسهٔ سشن کلاینت برای ردیابی و RecommendationSession.sessionId */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientSessionId?: string;

  /** منبع درخواست؛ در صورت عدم ارسال از روی userId/سناریو حدس زده می‌شود */
  @IsOptional()
  @IsEnum(RecommendationSource)
  source?: RecommendationSource;

  /** اگر باشد، بودجه/پروفایل از User + UserProfile ادغام می‌شود */
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RecommendationWeightsV2Dto)
  weights?: RecommendationWeightsV2Dto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  /** اگر با userId ست شود و matches نباشد، سگمنت‌های پروفایل اولویت می‌گیرند */
  @IsOptional()
  @IsString()
  segmentHint?: string;
}
