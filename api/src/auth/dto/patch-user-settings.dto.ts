import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class PatchUserSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  theme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  defaultPortfolioId?: string;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}
