export function fmtIRR(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fa-IR").format(Math.round(n));
}

/** اگر n بین 0 و 1 باشد به‌عنوان نسبت (مثلاً 0.08 → ۸٪) نمایش داده می‌شود */
export function fmtRatioAsPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(pct)}٪`;
}
