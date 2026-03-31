import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const USER_ACTION_VERBS = [
  'ACCEPT',
  'REJECT',
  'MODIFY',
  'IGNORE',
] as const;

export class RecordUserActionDto {
  @IsString()
  @MaxLength(64)
  userId!: string;

  @IsString()
  @MaxLength(80)
  actionType!: string;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  executionId?: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsIn([...USER_ACTION_VERBS])
  action!: (typeof USER_ACTION_VERBS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
