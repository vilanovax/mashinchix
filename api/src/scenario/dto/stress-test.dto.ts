import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class StressTestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @IsString({ each: true })
  carIds!: string[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  weights?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scenarioIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(1500)
  paths?: number;

  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}
