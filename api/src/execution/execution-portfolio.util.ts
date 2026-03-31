export function weightMapFromCars(
  cars: Array<{ carId: string; weight?: number }>,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cars) {
    const w =
      typeof c.weight === 'number' && Number.isFinite(c.weight) ? c.weight : 0;
    m.set(c.carId, w);
  }
  return m;
}

/** فاصلهٔ نیم‌مجموع |Δw| / ۲ روی اجتماع خودروها */
export function totalVariationDistance(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
  const keys = new Set([...a.keys(), ...b.keys()]);
  let s = 0;
  for (const k of keys) {
    s += Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0));
  }
  return s * 0.5;
}
