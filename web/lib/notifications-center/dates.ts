export type DayBucket = "today" | "yesterday" | "earlier";

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function bucketForDate(iso: string | Date): DayBucket {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const t0 = startOfLocalDay(new Date()).getTime();
  const t1 = t0 - 86400000;
  const tx = d.getTime();
  if (tx >= t0) return "today";
  if (tx >= t1) return "yesterday";
  return "earlier";
}

export const DAY_BUCKET_LABEL: Record<DayBucket, string> = {
  today: "امروز",
  yesterday: "دیروز",
  earlier: "قبلی‌تر",
};
