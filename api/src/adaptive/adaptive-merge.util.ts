export function mergeNumRecord(
  defaults: Record<string, number>,
  raw: unknown,
): Record<string, number> {
  const out = { ...defaults };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v;
    }
  }
  return out;
}

export function nearlyEqualRecord(
  a: Record<string, number>,
  b: Record<string, number>,
  eps = 1e-6,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const da = a[k];
    const db = b[k];
    if (da === undefined && db === undefined) continue;
    if (da === undefined || db === undefined) return false;
    if (!Number.isFinite(da) || !Number.isFinite(db)) return false;
    if (Math.abs(da - db) > eps) return false;
  }
  return true;
}
