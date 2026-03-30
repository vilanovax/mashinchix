import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

function parseCarIds(raw?: string): string[] | undefined {
  if (raw == null || raw.trim() === '') return undefined;
  const ids = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length ? ids : undefined;
}

export class PortfolioOptQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  budget!: number;

  @IsOptional()
  @IsString()
  carIds?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.05)
  @Max(1)
  maxWeightPerCar?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.2)
  @Max(1)
  maxWeightPerSegment?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  minLiquidity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.05)
  @Max(2)
  maxPortfolioVolatility?: number;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  riskTolerance?: 'LOW' | 'MEDIUM' | 'HIGH';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(800)
  mcSamples?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(5)
  @Max(24)
  steps?: number;

  toUniverseParams(): {
    budget: number;
    carIds?: string[];
    maxWeightPerCar?: number;
    maxWeightPerSegment?: number;
    minLiquidity?: number;
    maxPortfolioVolatility?: number;
    riskTolerance?: 'LOW' | 'MEDIUM' | 'HIGH';
    mcSamples?: number;
  } {
    return {
      budget: this.budget,
      carIds: parseCarIds(this.carIds),
      maxWeightPerCar: this.maxWeightPerCar,
      maxWeightPerSegment: this.maxWeightPerSegment,
      minLiquidity: this.minLiquidity,
      maxPortfolioVolatility: this.maxPortfolioVolatility,
      riskTolerance: this.riskTolerance,
      mcSamples: this.mcSamples,
    };
  }
}
