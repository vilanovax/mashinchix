import { Injectable } from '@nestjs/common';
import { CarSubstitutionService } from './car-substitution.service';

@Injectable()
export class RecommendationGraphEnrichmentService {
  constructor(private readonly substitution: CarSubstitutionService) {}

  async enrichV3(
    topCars: Array<{ id: string; brand: string; model: string }>,
    budget: number,
  ) {
    const ids = topCars.map((c) => c.id);
    const [diversification, substitutesByRank] = await Promise.all([
      this.substitution.diversificationNote(ids),
      Promise.all(
        topCars.slice(0, 3).map(async (c, idx) => ({
          forRank: idx + 1,
          carId: c.id,
          label: `${c.brand} ${c.model}`,
          cheaperAlternatives: await this.substitution.findSubstitutes(
            c.id,
            budget,
            5,
          ),
        })),
      ),
    ]);

    return {
      diversification,
      substitutesByRank,
      hints: [
        'گزینه‌های «جانشین» از روی گراف رقابت، همبستگی قیمت و تشابه سگمنت/قیمت هستند.',
        'برای کاهش ریسک هم‌جهتی، ترکیب خودروهایی با همبستگی قیمت پایین‌تر در سبد را در نظر بگیرید.',
      ],
    };
  }
}
