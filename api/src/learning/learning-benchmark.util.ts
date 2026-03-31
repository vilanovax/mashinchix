import { PrismaService } from '../prisma/prisma.service';
import {
  addCalendarDays,
  startOfUtcDay,
} from '../model-evaluation/eval-price.util';

/** میانگین بازده شاخص سگمنت‌ها بین دو تاریخ (نسبت میانگین شاخص). */
export async function avgSegmentIndexReturnPct(
  prisma: PrismaService,
  from: Date,
  horizonDays: number,
): Promise<number | null> {
  const d0 = startOfUtcDay(from);
  const d1 = startOfUtcDay(addCalendarDays(d0, horizonDays));
  const [rows0, rows1] = await Promise.all([
    prisma.segmentMarketIndex.findMany({ where: { snapshotDate: d0 } }),
    prisma.segmentMarketIndex.findMany({ where: { snapshotDate: d1 } }),
  ]);
  if (!rows0.length || !rows1.length) return null;
  const m0 = new Map(rows0.map((r) => [r.segment, r.indexValue]));
  const rets: number[] = [];
  for (const r of rows1) {
    const a = m0.get(r.segment);
    if (a == null || Math.abs(a) < 1e-9) continue;
    rets.push((r.indexValue - a) / Math.abs(a));
  }
  if (!rets.length) return null;
  return rets.reduce((x, y) => x + y, 0) / rets.length;
}
