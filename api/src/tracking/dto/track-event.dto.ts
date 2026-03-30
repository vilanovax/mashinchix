import { UserEventType } from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class TrackEventDto {
  @IsString()
  @MaxLength(200)
  sessionId!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsEnum(UserEventType)
  eventType!: UserEventType;

  @IsOptional()
  @IsString()
  carId?: string;

  @IsOptional()
  @IsString()
  recommendationSessionId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
