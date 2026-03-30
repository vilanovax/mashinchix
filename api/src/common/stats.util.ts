export function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** میانگین هرس‌شده از هر دو انتها (متناسب با n) */
export function trimmedMean(xs: number[], trimRatio = 0.1): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length * trimRatio);
  if (s.length <= k * 2) return mean(s);
  const slice = s.slice(k, s.length - k);
  return mean(slice);
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs)!;
  return Math.sqrt(
    xs.reduce((acc, x) => acc + (x - m) * (x - m), 0) / (xs.length - 1),
  );
}

export function coefficientOfVariation(xs: number[]): number | null {
  const m = mean(xs);
  if (m == null || m === 0) return null;
  return stdev(xs) / m;
}
