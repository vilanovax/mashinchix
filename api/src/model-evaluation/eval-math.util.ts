export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 5) return null;
  const n = xs.length;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const zx = xs[i] - mx;
    const zy = ys[i] - my;
    num += zx * zy;
    dx += zx * zx;
    dy += zy * zy;
  }
  const d = Math.sqrt(dx * dy);
  if (d < 1e-12) return null;
  return num / d;
}

export function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdSample(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v =
    xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}
