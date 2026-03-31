import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export const DECISION_FEEDBACK_VALUES = ['GOOD', 'BAD', 'NEUTRAL'] as const;

export class DecisionFeedbackDto {
  @IsString()
  @MaxLength(64)
  userId!: string;

  @IsString()
  decisionId!: string;

  @IsIn([...DECISION_FEEDBACK_VALUES])
  feedback!: (typeof DECISION_FEEDBACK_VALUES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
