import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PortfolioOptimizeDto } from './portfolio-optimize.dto';

class HoldingDto {
  @IsString()
  carId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight!: number;
}

export class PortfolioRebalanceDto extends PortfolioOptimizeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HoldingDto)
  currentHoldings!: HoldingDto[];
}
