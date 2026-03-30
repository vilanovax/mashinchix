import type { CarSpecs } from '@prisma/client';

/** تشابهٔ سادهٔ مشخصات فنی (۰–۱) */
export function specSimilarity(
  a: CarSpecs | null | undefined,
  b: CarSpecs | null | undefined,
): number {
  if (!a || !b) return 0.35;
  let hits = 0;
  let tests = 0;
  const cmp = (x: string | null | undefined, y: string | null | undefined) => {
    tests++;
    if (x && y && x.trim().toLowerCase() === y.trim().toLowerCase()) hits++;
  };
  cmp(a.fuelType, b.fuelType);
  cmp(a.gearbox, b.gearbox);
  cmp(a.transmission, b.transmission);
  cmp(a.engine, b.engine);
  return tests ? hits / tests : 0.35;
}

export function priceBandSimilarity(priceA: number, priceB: number): number {
  if (!Number.isFinite(priceA) || !Number.isFinite(priceB) || priceA <= 0)
    return 0;
  const m = (priceA + priceB) / 2;
  const d = Math.abs(priceA - priceB) / m;
  return Math.max(0, 1 - Math.min(1, d / 0.45));
}
