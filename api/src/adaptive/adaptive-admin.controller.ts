import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AdaptiveExperimentStatus } from '@prisma/client';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { AdaptiveVersioningService } from './adaptive-versioning.service';
import { AdaptiveRuntimeConfigService } from './adaptive-runtime-config.service';

class ScopeNotesDto {
  @IsString()
  scope!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class RollbackBodyDto {
  @IsString()
  scope!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

@Controller('adaptive')
export class AdaptiveAdminController {
  constructor(
    private readonly versioning: AdaptiveVersioningService,
    private readonly prisma: PrismaService,
    private readonly runtime: AdaptiveRuntimeConfigService,
  ) {}

  @Post('freeze')
  freeze(@Body() body: ScopeNotesDto) {
    return this.versioning.freeze(body.scope, body.notes);
  }

  @Post('unfreeze')
  unfreeze(@Body() body: ScopeNotesDto) {
    return this.versioning.unfreeze(body.scope, body.notes);
  }

  @Post('rollback')
  rollback(@Body() body: RollbackBodyDto) {
    return this.versioning.rollbackToVersion(
      body.scope,
      body.version,
      body.notes,
    );
  }

  @Get('versions')
  versions(
    @Query('scope') scope?: string,
    @Query('take') takeRaw?: string,
  ) {
    const take = Math.min(Math.max(Number(takeRaw) || 80, 1), 500);
    return this.prisma.adaptiveWeightVersion.findMany({
      where: scope ? { scope } : undefined,
      orderBy: [{ scope: 'asc' }, { version: 'desc' }],
      take,
    });
  }

  @Get('events')
  events(
    @Query('scope') scope?: string,
    @Query('take') takeRaw?: string,
  ) {
    const take = Math.min(Math.max(Number(takeRaw) || 200, 1), 1_000);
    return this.prisma.adaptiveEvent.findMany({
      where: scope ? { scope } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  @Get('status')
  async status() {
    await this.runtime.ensureSeeds();
    const [controls, activeVersions, frozen] = await Promise.all([
      this.prisma.adaptiveControl.findMany(),
      this.prisma.adaptiveWeightVersion.findMany({
        where: { isActive: true },
      }),
      this.prisma.adaptiveControl.count({ where: { isFrozen: true } }),
    ]);
    return {
      controls,
      activeVersions,
      frozenScopeCount: frozen,
      experiments: await this.prisma.adaptiveExperiment.findMany({
        where: { status: AdaptiveExperimentStatus.RUNNING },
        take: 20,
      }),
    };
  }
}
