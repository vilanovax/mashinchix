import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const OPT_METHODOLOGIES = [
  'MAX_SHARPE',
  'MIN_VOLATILITY',
  'MAX_RETURN',
  'RISK_PARITY',
  'ERC',
  'ROBUST',
  'KELLY',
  'SEGMENT_BALANCED',
] as const;

export type OptimizationMethodology = (typeof OPT_METHODOLOGIES)[number];

export class PortfolioOptimizeDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(18)
  @IsString({ each: true })
  carIds?: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  budget!: number;

  @IsIn([...OPT_METHODOLOGIES])
  methodology!: OptimizationMethodology;

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
  @IsBoolean()
  persist?: boolean;

  @IsOptional()
  @IsBoolean()
  useHistoricalMaxDrawdown?: boolean;
}
