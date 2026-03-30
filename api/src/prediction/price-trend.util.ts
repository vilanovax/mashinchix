/** رگرسیون خطی ساده: y = intercept + slope * t */
export function linearRegression(x: number[], y: number[]): {
  slope: number;
  intercept: number;
} {
  const n = x.length;
  const meanT = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - meanT) * (y[i] - meanY);
    den += (x[i] - meanT) ** 2;
  }
  if (den === 0) return { slope: 0, intercept: meanY };
  const slope = num / den;
  const intercept = meanY - slope * meanT;
  return { slope, intercept };
}

export function rSquared(
  x: number[],
  y: number[],
  slope: number,
  intercept: number,
): number {
  const meanY = y.reduce((a, b) => a + b, 0) / y.length;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < y.length; i++) {
    const pred = intercept + slope * x[i];
    const err = y[i] - meanY;
    ssTot += err * err;
    ssRes += (y[i] - pred) ** 2;
  }
  if (ssTot === 0) return 1;
  return Math.max(0, Math.min(1, 1 - ssRes / ssTot));
}
