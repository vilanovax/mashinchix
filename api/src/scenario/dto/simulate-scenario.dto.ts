import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SimulateScenarioDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @IsString({ each: true })
  carIds!: string[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  weights?: number[];

  @IsString()
  scenarioId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(2500)
  paths?: number;
}
