import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/** وزن‌های دلخواه ابعاد امتیاز (مقادیر نسبی؛ اگر نباشد پیش‌فرض ۱) */
export class ScoreWeightsJsonDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  performance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  comfort?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  economy?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reliability?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  market?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ownership?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prestige?: number;

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

export class UpsertUserProfileDto {
  @IsOptional()
  @IsObject()
  @Type(() => ScoreWeightsJsonDto)
  scoreWeights?: ScoreWeightsJsonDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredSegments?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minBudget?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxBudget?: number;

  /** ۰–۱ میزان اهمیت «سرمایه‌گذاری» در توصیه */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  investmentBias?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  holdHorizonMonths?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  popularityWeight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ownerSatisfactionWeight?: number;
}
