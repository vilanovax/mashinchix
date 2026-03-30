import { Type } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ReviewItemDto {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsObject()
  rawMetadata?: Record<string, unknown>;
}

export class IngestReviewsDto {
  @IsString()
  @MinLength(1)
  carId!: string;

  @IsString()
  @MinLength(1)
  source!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewItemDto)
  items!: ReviewItemDto[];
}
