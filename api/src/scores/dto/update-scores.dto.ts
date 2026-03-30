import { IsNumber, IsOptional } from 'class-validator';

export class UpdateScoresDto {
  @IsOptional()
  @IsNumber()
  performanceScore?: number;

  @IsOptional()
  @IsNumber()
  comfortScore?: number;

  @IsOptional()
  @IsNumber()
  economyScore?: number;

  @IsOptional()
  @IsNumber()
  reliabilityScore?: number;

  @IsOptional()
  @IsNumber()
  marketScore?: number;

  @IsOptional()
  @IsNumber()
  ownershipScore?: number;

  @IsOptional()
  @IsNumber()
  prestigeScore?: number;

  @IsOptional()
  @IsNumber()
  riskScore?: number;

  @IsOptional()
  @IsNumber()
  overallScore?: number;
}
