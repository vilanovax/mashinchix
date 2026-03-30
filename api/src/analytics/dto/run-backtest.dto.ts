import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { BacktestStrategyName } from '@prisma/client';

export class RunBacktestDto {
  @IsEnum(BacktestStrategyName)
  strategy!: BacktestStrategyName;

  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Type(() => Date)
  @IsDate()
  endDate!: Date;
}

export class RunPortfolioSimulationDto extends RunBacktestDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  initialCapital!: number;

  @IsOptional()
  @IsString()
  userId?: string;
}
