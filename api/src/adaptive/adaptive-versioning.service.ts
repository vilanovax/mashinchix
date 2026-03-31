import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AdaptiveEventType,
  AdaptiveWeightSource,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nearlyEqualRecord } from './adaptive-merge.util';

@Injectable()
export class AdaptiveVersioningService {
  private readonly logger = new Logger(AdaptiveVersioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ensureControlRow(scope: string): Promise<void> {
    await this.prisma.adaptiveControl.upsert({
      where: { scope },
      create: { scope, isFrozen: false },
      update: {},
    });
  }

  async isFrozen(scope: string): Promise<boolean> {
    const c = await this.prisma.adaptiveControl.findUnique({
      where: { scope },
    });
    return c?.isFrozen === true;
  }

  async shouldSkipLearningMutation(
    scope: string,
    source: AdaptiveWeightSource,
  ): Promise<boolean> {
    if (source !== AdaptiveWeightSource.LEARNING) return false;
    await this.ensureControlRow(scope);
    return this.isFrozen(scope);
  }

  async logEvent(input: {
    scope: string;
    eventType: AdaptiveEventType;
    previousValue?: unknown;
    newValue?: unknown;
    reason?: string | null;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.adaptiveEvent.create({
      data: {
        scope: input.scope,
        eventType: input.eventType,
        previousValue:
          input.previousValue === undefined
            ? Prisma.JsonNull
            : (input.previousValue as Prisma.InputJsonValue),
        newValue:
          input.newValue === undefined
            ? Prisma.JsonNull
            : (input.newValue as Prisma.InputJsonValue),
        reason: input.reason ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  }

  async persistNumericUpdate(
    scope: string,
    proposed: Record<string, number>,
    previous: Record<string, number>,
    source: AdaptiveWeightSource,
    notes: string | null,
    guardrailMeta: { clamped: boolean; warnings: string[] },
  ): Promise<{ skipped: boolean; version: number }> {
    await this.ensureControlRow(scope);

    if (await this.shouldSkipLearningMutation(scope, source)) {
      const row = await this.prisma.adaptiveWeights.findUnique({
        where: { scope },
      });
      return { skipped: true, version: row?.version ?? 0 };
    }

    if (nearlyEqualRecord(previous, proposed)) {
      const row = await this.prisma.adaptiveWeights.findUnique({
        where: { scope },
      });
      return { skipped: true, version: row?.version ?? 0 };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.adaptiveWeights.update({
        where: { scope },
        data: {
          weights: proposed as unknown as Prisma.InputJsonValue,
          version: { increment: 1 },
          note: notes,
        },
      });

      await tx.adaptiveWeightVersion.updateMany({
        where: { scope },
        data: { isActive: false },
      });

      await tx.adaptiveWeightVersion.create({
        data: {
          scope,
          version: row.version,
          weights: proposed as unknown as Prisma.InputJsonValue,
          source,
          notes,
          isActive: true,
        },
      });

      await tx.adaptiveEvent.create({
        data: {
          scope,
          eventType: AdaptiveEventType.WEIGHT_UPDATED,
          previousValue: previous as unknown as Prisma.InputJsonValue,
          newValue: proposed as unknown as Prisma.InputJsonValue,
          reason: notes,
          metadata: { source } as Prisma.InputJsonValue,
        },
      });

      if (guardrailMeta.clamped) {
        await tx.adaptiveEvent.create({
          data: {
            scope,
            eventType: AdaptiveEventType.GUARDRAIL_CLAMPED,
            previousValue: previous as unknown as Prisma.InputJsonValue,
            newValue: proposed as unknown as Prisma.InputJsonValue,
            reason: 'guardrail clamp applied',
            metadata: {
              warnings: guardrailMeta.warnings,
              source,
            } as Prisma.InputJsonValue,
          },
        });
      }

      return row;
    });

    this.logger.log(`Adaptive ${scope} v${updated.version} (${source})`);
    return { skipped: false, version: updated.version };
  }

  async persistJsonUpdate(
    scope: string,
    proposed: Record<string, unknown>,
    previous: Record<string, unknown>,
    source: AdaptiveWeightSource,
    notes: string | null,
    guardrailMeta: { clamped: boolean; warnings: string[] },
  ): Promise<{ skipped: boolean; version: number }> {
    await this.ensureControlRow(scope);

    if (await this.shouldSkipLearningMutation(scope, source)) {
      const row = await this.prisma.adaptiveWeights.findUnique({
        where: { scope },
      });
      return { skipped: true, version: row?.version ?? 0 };
    }

    if (JSON.stringify(previous) === JSON.stringify(proposed)) {
      const row = await this.prisma.adaptiveWeights.findUnique({
        where: { scope },
      });
      return { skipped: true, version: row?.version ?? 0 };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.adaptiveWeights.update({
        where: { scope },
        data: {
          weights: proposed as unknown as Prisma.InputJsonValue,
          version: { increment: 1 },
          note: notes,
        },
      });

      await tx.adaptiveWeightVersion.updateMany({
        where: { scope },
        data: { isActive: false },
      });

      await tx.adaptiveWeightVersion.create({
        data: {
          scope,
          version: row.version,
          weights: proposed as unknown as Prisma.InputJsonValue,
          source,
          notes,
          isActive: true,
        },
      });

      await tx.adaptiveEvent.create({
        data: {
          scope,
          eventType: AdaptiveEventType.WEIGHT_UPDATED,
          previousValue: previous as unknown as Prisma.InputJsonValue,
          newValue: proposed as unknown as Prisma.InputJsonValue,
          reason: notes,
          metadata: { source, kind: 'model_selection' } as Prisma.InputJsonValue,
        },
      });

      if (guardrailMeta.clamped) {
        await tx.adaptiveEvent.create({
          data: {
            scope,
            eventType: AdaptiveEventType.GUARDRAIL_CLAMPED,
            reason: 'guardrail clamp applied',
            metadata: {
              warnings: guardrailMeta.warnings,
            } as Prisma.InputJsonValue,
          },
        });
      }

      return row;
    });

    this.logger.log(`Adaptive ${scope} (json) v${updated.version}`);
    return { skipped: false, version: updated.version };
  }

  async rollbackToVersion(
    scope: string,
    version: number,
    notes?: string | null,
  ): Promise<{ version: number }> {
    const snap = await this.prisma.adaptiveWeightVersion.findUnique({
      where: { scope_version: { scope, version } },
    });
    if (!snap) {
      throw new NotFoundException(`نسخه ${version} برای ${scope} یافت نشد`);
    }

    const weights = snap.weights as Record<string, number> | Record<string, unknown>;
    const prevRow = await this.prisma.adaptiveWeights.findUnique({
      where: { scope },
    });
    const previous = prevRow?.weights ?? {};

    await this.prisma.$transaction(async (tx) => {
      const row = await tx.adaptiveWeights.update({
        where: { scope },
        data: {
          weights: weights as Prisma.InputJsonValue,
          version: { increment: 1 },
          note: notes ?? `rollback to v${version}`,
        },
      });

      await tx.adaptiveWeightVersion.updateMany({
        where: { scope },
        data: { isActive: false },
      });

      await tx.adaptiveWeightVersion.create({
        data: {
          scope,
          version: row.version,
          weights: weights as Prisma.InputJsonValue,
          source: AdaptiveWeightSource.ROLLBACK,
          notes: notes ?? `rollback from v${version}`,
          isActive: true,
        },
      });

      await tx.adaptiveEvent.create({
        data: {
          scope,
          eventType: AdaptiveEventType.ROLLBACK,
          previousValue: previous as Prisma.InputJsonValue,
          newValue: weights as Prisma.InputJsonValue,
          reason: `rollback to snapshot v${version}`,
          metadata: { fromSnapshotVersion: version } as Prisma.InputJsonValue,
        },
      });

      await tx.adaptiveControl.update({
        where: { scope },
        data: { rollbackToVersion: null },
      });
    });

    const row = await this.prisma.adaptiveWeights.findUnique({
      where: { scope },
    });
    return { version: row!.version };
  }

  async freeze(scope: string, notes?: string | null): Promise<void> {
    await this.ensureControlRow(scope);
    await this.prisma.adaptiveControl.update({
      where: { scope },
      data: { isFrozen: true, notes: notes ?? null },
    });
    await this.logEvent({
      scope,
      eventType: AdaptiveEventType.FREEZE,
      reason: notes ?? 'freeze',
    });
  }

  async unfreeze(scope: string, notes?: string | null): Promise<void> {
    await this.ensureControlRow(scope);
    await this.prisma.adaptiveControl.update({
      where: { scope },
      data: { isFrozen: false, notes: notes ?? null },
    });
    await this.logEvent({
      scope,
      eventType: AdaptiveEventType.UNFREEZE,
      reason: notes ?? 'unfreeze',
    });
  }

  async setRollbackPointer(
    scope: string,
    version: number | null,
    notes?: string | null,
  ): Promise<void> {
    await this.ensureControlRow(scope);
    await this.prisma.adaptiveControl.update({
      where: { scope },
      data: { rollbackToVersion: version, notes: notes ?? null },
    });
  }

  /** عقب‌گرد به نسخهٔ snapshot قبلی (بدون نیاز به شماره دستی). */
  async rollbackToPreviousNumericVersion(
    scope: string,
    reason: string,
  ): Promise<boolean> {
    const active = await this.prisma.adaptiveWeightVersion.findFirst({
      where: { scope, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!active || active.version <= 1) return false;
    const targetVersion = active.version - 1;
    const snap = await this.prisma.adaptiveWeightVersion.findUnique({
      where: { scope_version: { scope, version: targetVersion } },
    });
    if (!snap) return false;
    await this.rollbackToVersion(scope, targetVersion, reason);
    return true;
  }
}
