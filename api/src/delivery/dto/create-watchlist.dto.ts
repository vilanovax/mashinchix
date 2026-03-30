import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Prisma } from '@prisma/client';

export class CreateWatchlistDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  carId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetBuyPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetSellPrice?: number;

  @IsOptional()
  @IsBoolean()
  alertOnPriceDrop?: boolean;

  @IsOptional()
  @IsBoolean()
  alertOnPriceRise?: boolean;

  @IsOptional()
  @IsBoolean()
  alertOnBuySignal?: boolean;

  @IsOptional()
  @IsBoolean()
  alertOnSellSignal?: boolean;

  @IsOptional()
  @IsBoolean()
  alertOnHighRisk?: boolean;

  @IsOptional()
  @IsBoolean()
  alertOnMomentum?: boolean;
}

export function toDecimalOrNull(n?: number): Prisma.Decimal | null {
  if (n == null || !Number.isFinite(n)) return null;
  return new Prisma.Decimal(n);
}
