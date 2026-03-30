import { ListingSource } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCarAliasDto {
  @IsString()
  @MinLength(1)
  carId!: string;

  @IsString()
  @MinLength(1)
  alias!: string;

  @IsOptional()
  @IsEnum(ListingSource)
  sourceFilter?: ListingSource;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
