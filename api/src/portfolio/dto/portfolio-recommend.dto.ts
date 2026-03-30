import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RecommendPortfolioDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  budget!: number;

  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  riskTolerance!: 'LOW' | 'MEDIUM' | 'HIGH';

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(120)
  investmentHorizonMonths!: number;

  @IsOptional()
  @IsString({ each: true })
  preferredSegments?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(3)
  @Max(12)
  maxCars?: number;

  @IsIn(['growth', 'income', 'low-risk', 'balanced'])
  strategyPreference!: 'growth' | 'income' | 'low-risk' | 'balanced';

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}
