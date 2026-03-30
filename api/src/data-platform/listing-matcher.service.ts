import { Injectable } from '@nestjs/common';
import { ListingSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  normalizeAliasPhrase,
  normalizePersianTitle,
} from '../common/text-normalize';

export type CarMatchRow = { id: string; brand: string; model: string };

export type CarAliasRow = {
  normalized: string;
  carId: string;
  weight: number;
  sourceFilter: ListingSource | null;
};

@Injectable()
export class ListingMatcherService {
  constructor(private readonly prisma: PrismaService) {}

  async loadCarsForMatching(): Promise<CarMatchRow[]> {
    return this.prisma.car.findMany({
      select: { id: true, brand: true, model: true },
    });
  }

  async loadActiveAliases(): Promise<CarAliasRow[]> {
    const rows = await this.prisma.carAlias.findMany({
      where: { isActive: true },
      select: {
        normalized: true,
        carId: true,
        weight: true,
        sourceFilter: true,
      },
    });
    return rows.map((r) => ({
      normalized: r.normalized,
      carId: r.carId,
      weight: r.weight,
      sourceFilter: r.sourceFilter,
    }));
  }

  /**
   * تطبیق کامل: ابتدا alias (وزن و طول)، سپس برند+مدل در عنوان.
   */
  matchCarId(
    title: string,
    source: ListingSource,
    cars: CarMatchRow[],
    aliases: CarAliasRow[],
  ): string | null {
    if (!title?.trim()) return null;

    const nt = normalizePersianTitle(title);

    const applicable = aliases.filter(
      (a) => a.sourceFilter == null || a.sourceFilter === source,
    );
    const sorted = [...applicable].sort(
      (a, b) =>
        b.weight - a.weight ||
        b.normalized.length - a.normalized.length,
    );

    for (const a of sorted) {
      if (a.normalized.length >= 2 && nt.includes(a.normalized)) {
        return a.carId;
      }
    }

    for (const c of cars) {
      const b = normalizePersianTitle(c.brand);
      const m = normalizePersianTitle(c.model);
      if (b.length >= 2 && m.length >= 2 && nt.includes(b) && nt.includes(m)) {
        return c.id;
      }
    }
    return null;
  }

  /** رزولوشن یک‌مرحله‌ای برای اسکرپرها */
  async resolveCarId(
    title: string,
    source: ListingSource,
  ): Promise<string | null> {
    const [cars, aliases] = await Promise.all([
      this.loadCarsForMatching(),
      this.loadActiveAliases(),
    ]);
    return this.matchCarId(title, source, cars, aliases);
  }

  /** نرمال‌سازی برای ذخیرهٔ CarAlias (یکتا بودن) */
  static normalizeForStorage(raw: string): string {
    return normalizeAliasPhrase(raw);
  }
}
