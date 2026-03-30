import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const RANKING_SORT_VALUES = [
  'overall',
  'performance',
  'comfort',
  'economy',
  'reliability',
  'market',
  'ownership',
  'prestige',
  'risk',
] as const;

export type RankingSort = (typeof RANKING_SORT_VALUES)[number];

export class QueryRankingsDto {
  @IsOptional()
  @IsIn(RANKING_SORT_VALUES as unknown as string[])
  sort?: RankingSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  segment?: string;
}
