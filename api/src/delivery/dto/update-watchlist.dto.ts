import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Prisma } from '@prisma/client';

export class UpdateWatchlistDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetBuyPrice?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetSellPrice?: number | null;

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

export function nullableDecimal(
  n: number | null | undefined,
): Prisma.Decimal | null | undefined {
  if (n === undefined) return undefined;
  if (n === null) return null;
  if (!Number.isFinite(n)) return null;
  return new Prisma.Decimal(n);
}
