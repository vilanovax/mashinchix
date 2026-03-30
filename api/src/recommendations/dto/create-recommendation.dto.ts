import { Type } from 'class-transformer';
import {
  IsNumber,
  IsObject,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

export class RecommendationWeightsDto {
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

  /** وزنی که در فرمول از امتیاز ریسک کم می‌شود */
  @IsOptional()
  @IsNumber()
  @Min(0)
  risk?: number;
}

export class CreateRecommendationDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget!: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RecommendationWeightsDto)
  weights?: RecommendationWeightsDto;
}
