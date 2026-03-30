/** مرز روز UTC و تاریخ نمونه برای فیلدهای @db.Date */
export function utcDayBounds(input: Date): {
  start: Date;
  end: Date;
  snapshot: Date;
} {
  const y = input.getUTCFullYear();
  const m = input.getUTCMonth();
  const d = input.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
  const snapshot = new Date(Date.UTC(y, m, d, 12, 0, 0, 0));
  return { start, end, snapshot };
}

export function parseOptionalDay(s?: string): Date {
  if (!s?.trim()) return new Date();
  const t = Date.parse(`${s.trim()}T12:00:00.000Z`);
  if (!Number.isFinite(t)) return new Date();
  return new Date(t);
}
