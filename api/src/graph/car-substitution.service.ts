import { Injectable, NotFoundException } from '@nestjs/common';
import { CarGraphRelationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { priceBandSimilarity, specSimilarity } from './graph-spec-sim.util';

export type SubstitutionHit = {
  carId: string;
  brand: string;
  model: string;
  year: number;
  segment: string | null;
  avgPrice: number | null;
  strength: number;
  sources: string[];
};

@Injectable()
export class CarSubstitutionService {
  constructor(private readonly prisma: PrismaService) {}

  async getCarOrThrow(carId: string) {
    const car = await this.prisma.car.findUnique({
      where: { id: carId },
      include: { marketData: true, scores: true, specs: true },
    });
    if (!car) throw new NotFoundException('خودرو یافت نشد');
    return car;
  }

  /** جانشین‌ها: یال گراف + فیلتر بودجه + امتیاز زنده */
  async findSubstitutes(
    carId: string,
    budget: number,
    limit = 10,
  ): Promise<SubstitutionHit[]> {
    const base = await this.getCarOrThrow(carId);
    const basePrice = Number(base.marketData?.avgPrice ?? 0);

    const rels = await this.prisma.carRelationship.findMany({
      where: {
        carId,
        relationType: {
          in: [
            CarGraphRelationType.SUBSTITUTE,
            CarGraphRelationType.COMPETITOR,
            CarGraphRelationType.SIMILAR,
            CarGraphRelationType.SAME_SEGMENT,
          ],
        },
      },
      orderBy: { strength: 'desc' },
      take: 60,
      include: {
        relatedCar: {
          include: { marketData: true, scores: true, specs: true },
        },
      },
    });

    const scored: SubstitutionHit[] = [];
    for (const r of rels) {
      const c = r.relatedCar;
      const p = Number(c.marketData?.avgPrice ?? 0);
      if (p > budget * 1.02 || !Number.isFinite(p) || p <= 0) continue;
      if (c.id === carId) continue;
      const sp = specSimilarity(base.specs, c.specs);
      const pb =
        basePrice > 0 ? priceBandSimilarity(basePrice, p) : 0.5;
      const live =
        r.strength * 0.45 +
        sp * 0.22 +
        pb * 0.28 +
        (c.scores?.investmentScore ?? 50) / 500;
      const sources = [r.relationType];
      scored.push({
        carId: c.id,
        brand: c.brand,
        model: c.model,
        year: c.year,
        segment: c.segment,
        avgPrice: p,
        strength: Math.min(1, live),
        sources,
      });
    }

    scored.sort((a, b) => b.strength - a.strength);
    const seen = new Set<string>();
    return scored.filter((x) => {
      if (seen.has(x.carId)) return false;
      seen.add(x.carId);
      return true;
    }).slice(0, limit);
  }

  async findSimilar(carId: string, limit = 12): Promise<SubstitutionHit[]> {
    await this.getCarOrThrow(carId);
    const rows = await this.prisma.carSimilarityScore.findMany({
      where: { carId },
      orderBy: { score: 'desc' },
      take: 40,
      include: {
        peer: { include: { marketData: true } },
      },
    });
    return rows.map((r) => ({
      carId: r.peerCarId,
      brand: r.peer.brand,
      model: r.peer.model,
      year: r.peer.year,
      segment: r.peer.segment,
      avgPrice: r.peer.marketData?.avgPrice
        ? Number(r.peer.marketData.avgPrice)
        : null,
      strength: r.score,
      sources: ['similarity-score'],
    })).slice(0, limit);
  }

  async findCorrelated(
    carId: string,
    limit = 15,
  ): Promise<
    Array<{
      carId: string;
      relationType: CarGraphRelationType;
      strength: number;
      brand: string;
      model: string;
    }>
  > {
    await this.getCarOrThrow(carId);
    const rows = await this.prisma.carRelationship.findMany({
      where: {
        carId,
        relationType: {
          in: [
            CarGraphRelationType.PRICE_CORRELATED,
            CarGraphRelationType.MOMENTUM_CORRELATED,
            CarGraphRelationType.LIQUIDITY_CORRELATED,
            CarGraphRelationType.RISK_CORRELATED,
          ],
        },
      },
      orderBy: { strength: 'desc' },
      take: limit,
      include: { relatedCar: { select: { brand: true, model: true } } },
    });
    return rows.map((r) => ({
      carId: r.relatedCarId,
      relationType: r.relationType,
      strength: r.strength,
      brand: r.relatedCar.brand,
      model: r.relatedCar.model,
    }));
  }

  /** یادداشت تنوع: اگر میانگیل همبستگی قیمت بین کاندیدها زیاد باشد هشدار */
  async diversificationNote(candidateCarIds: string[]): Promise<{
    avgPairwisePriceCorr: number | null;
    message: string;
  }> {
    const ids = [...new Set(candidateCarIds)].slice(0, 8);
    if (ids.length < 2) {
      return {
        avgPairwisePriceCorr: null,
        message: 'کاندید کافی برای تحلیل تنوع نیست.',
      };
    }
    const strengths: number[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const e = await this.prisma.carRelationship.findFirst({
          where: {
            carId: ids[i]!,
            relatedCarId: ids[j]!,
            relationType: CarGraphRelationType.PRICE_CORRELATED,
          },
          select: { strength: true },
        });
        if (e) strengths.push(e.strength);
      }
    }
    if (!strengths.length) {
      return {
        avgPairwisePriceCorr: null,
        message:
          'یال همبستگی قیمت در گراف برای این جفت‌ها ثبت نشده؛ پس از اجرای بازمحاسبهٔ گراف دوباره امتحان کنید.',
      };
    }
    const avg = strengths.reduce((a, b) => a + b, 0) / strengths.length;
    const message =
      avg > 0.72
        ? 'همبستگی قیمت بین گزینه‌های برتر بالاست؛ برای کاهش ریسک سیستماتیک سگمنت/نماد متفاوت اضافه کنید.'
        : avg > 0.48
          ? 'تنوع متوسط است؛ ترکیب سگمنت یا نوسان کم‌همبستگی می‌تواند مفید باشد.'
          : 'از نظر همبستگی قیمت در گراف، تنوع نسبتاً قابل قبول است.';
    return { avgPairwisePriceCorr: avg, message };
  }
}
