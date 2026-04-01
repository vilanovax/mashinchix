import { ListingCondition, RiskLevel, UsageType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** وزن‌های ویزارد؛ اگر بعضی فیلدها خالی باشند در سرویس مقدار پیش‌فرض می‌گیرند */
export class WizardWeightsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  performance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  comfort?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  economy?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reliability?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  market?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ownership?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  prestige?: number;

  /** در فرمول v3 از امتیاز ریسک کم می‌شود */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  risk?: number;
}

export class WizardPreferencesDto {
  @ValidateNested()
  @Type(() => WizardWeightsDto)
  weights!: WizardWeightsDto;
}

export class PatchWizardDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget!: number;

  @IsEnum(ListingCondition)
  listingCondition!: ListingCondition;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  holdYears?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'حداقل یک نوع کاربری انتخاب کنید' })
  @IsEnum(UsageType, { each: true })
  usageTags!: UsageType[];

  @ValidateNested()
  @Type(() => WizardPreferencesDto)
  preferences!: WizardPreferencesDto;

  @IsEnum(RiskLevel)
  riskLevel!: RiskLevel;

  @IsArray()
  @IsOptional()
  previousCarIds?: string[];
}
