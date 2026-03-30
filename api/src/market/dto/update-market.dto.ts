import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateMarketDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  avgPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  adsCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceChange30d?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceChange1y?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  liquidityScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  depreciationRate30d?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceTrendScore?: number;

  @IsOptional()
  @IsString()
  priceTrendLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  demandScore?: number;
}
