/** b = A x (مربع n×n) */
export function matVec(A: number[][], x: number[]): number[] {
  return A.map((row) => row.reduce((s, a, j) => s + a * (x[j] ?? 0), 0));
}

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * (b[i] ?? 0);
  return s;
}

/** واریانس پورتفو w' Σ w با Σ از corr و sigma (annual) */
export function portfolioVariance(
  w: number[],
  sigma: number[],
  corr: number[][],
): number {
  let v = 0;
  const n = w.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const rij = corr[i]![j] ?? (i === j ? 1 : 0);
      v += w[i]! * w[j]! * sigma[i]! * sigma[j]! * rij;
    }
  }
  return Math.max(0, v);
}

export function portfolioVol(w: number[], sigma: number[], corr: number[][]): number {
  return Math.sqrt(portfolioVariance(w, sigma, corr));
}

export function diversificationScore(weights: number[]): number {
  const h = weights.reduce((s, w) => s + w * w, 0);
  if (h < 1e-12) return 0;
  return Math.min(1, 1 / h / weights.length);
}

export function effectiveN(weights: number[]): number {
  const h = weights.reduce((s, w) => s + w * w, 0);
  return h > 1e-12 ? 1 / h : 0;
}

/** سهم ریسک نسبی: w_i (Σw)_i / (w'Σw) */
export function riskContributions(
  w: number[],
  sigma: number[],
  corr: number[][],
): number[] {
  const n = w.length;
  const covMw = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const rij = corr[i]![j] ?? (i === j ? 1 : 0);
      covMw[i]! += w[j]! * sigma[i]! * sigma[j]! * rij;
    }
  }
  const varP = portfolioVariance(w, sigma, corr);
  if (varP < 1e-14) return w.map(() => 1 / n);
  return w.map((wi, i) => (wi * covMw[i]!) / varP);
}

export function randomSimplexWeights(n: number): number[] {
  const g = Array.from({ length: n }, () => Math.random() + 0.05);
  const s = g.reduce((a, b) => a + b, 0);
  return g.map((x) => x / s);
}

export function projectWeightsToCaps(
  w: number[],
  segments: string[],
  maxCar: number,
  maxSeg: number,
): number[] {
  let x = w.map((v) => Math.max(0, v));
  let t = x.reduce((a, b) => a + b, 0);
  if (t < 1e-12) x = x.map(() => 1 / x.length);
  else x = x.map((v) => v / t);

  for (let iter = 0; iter < 28; iter++) {
    let changed = false;
    for (let i = 0; i < x.length; i++) {
      if (x[i]! > maxCar + 1e-9) {
        const ex = x[i]! - maxCar;
        x[i] = maxCar;
        const rest = x.reduce((a, v, j) => a + (j === i ? 0 : v), 0);
        if (rest > 1e-12) {
          for (let j = 0; j < x.length; j++) {
            if (j !== i) x[j]! += ex * (x[j]! / rest);
          }
        }
        changed = true;
      }
    }
    const bySeg = new Map<string, number>();
    x.forEach((v, i) => {
      const seg = segments[i] || '_';
      bySeg.set(seg, (bySeg.get(seg) ?? 0) + v);
    });
    for (const [seg, tot] of bySeg) {
      if (tot > maxSeg + 1e-9) {
        const ex = tot - maxSeg;
        const idx = x.map((_, i) => i).filter((i) => (segments[i] || '_') === seg);
        const sub = idx.reduce((a, i) => a + x[i]!, 0);
        if (sub < 1e-12) continue;
        idx.forEach((i) => {
          x[i]! -= ex * (x[i]! / sub);
        });
        const oidx = x
          .map((_, i) => i)
          .filter((i) => (segments[i] || '_') !== seg);
        const osub = oidx.reduce((a, i) => a + x[i]!, 0);
        if (osub > 1e-12) {
          oidx.forEach((i) => {
            x[i]! += ex * (x[i]! / osub);
          });
        }
        changed = true;
      }
    }
    t = x.reduce((a, b) => a + b, 0);
    if (t > 1e-12) x = x.map((v) => v / t);
    if (!changed) break;
  }
  return x.map((v) => Math.max(0, v));
}

/** تقریب max drawdown از نوسان سالانه (دوره≈۱ سال) */
export function analyticMaxDrawdownApprox(annualVol: number): number {
  return Math.min(0.95, annualVol * 2.33);
}
