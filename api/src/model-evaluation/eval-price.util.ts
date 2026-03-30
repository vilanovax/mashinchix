import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/decimal.util';

export function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export function addCalendarDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return startOfUtcDay(x);
}

export function subCalendarDays(d: Date, n: number): Date {
  return addCalendarDays(d, -n);
}

export async function priceOnOrAfter(
  prisma: PrismaService,
  carId: string,
  fromInclusive: Date,
): Promise<number | null> {
  const row = await prisma.priceHistory.findFirst({
    where: { carId, date: { gte: startOfUtcDay(fromInclusive) } },
    orderBy: { date: 'asc' },
  });
  if (!row) return null;
  return toNumber(row.price);
}

export async function priceOnOrBeforeDb(
  prisma: PrismaService,
  carId: string,
  onOrBefore: Date,
): Promise<number | null> {
  const row = await prisma.priceHistory.findFirst({
    where: { carId, date: { lte: startOfUtcDay(onOrBefore) } },
    orderBy: { date: 'desc' },
  });
  if (!row) return null;
  return toNumber(row.price);
}

export async function loadPriceSeries(
  prisma: PrismaService,
  carId: string,
  start: Date,
  end: Date,
): Promise<Array<{ t: number; p: number }>> {
  const rows = await prisma.priceHistory.findMany({
    where: {
      carId,
      date: {
        gte: startOfUtcDay(start),
        lte: startOfUtcDay(end),
      },
    },
    orderBy: { date: 'asc' },
  });
  return rows
    .map((r) => ({
      t: r.date.getTime(),
      p: toNumber(r.price) ?? 0,
    }))
    .filter((x) => x.p > 0);
}

export function maxDrawdownFromPrices(prices: number[]): number {
  if (prices.length < 2) return 0;
  let peak = prices[0];
  let maxDd = 0;
  for (const v of prices) {
    peak = Math.max(peak, v);
    if (peak > 0) maxDd = Math.max(maxDd, (peak - v) / peak);
  }
  return maxDd;
}

export function volatilityOfReturns(prices: number[]): number {
  if (prices.length < 3) return 0;
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const a = prices[i - 1];
    const b = prices[i];
    if (a > 0 && b > 0) r.push(Math.log(b / a));
  }
  if (r.length < 2) return 0;
  const m = r.reduce((x, y) => x + y, 0) / r.length;
  const v =
    r.reduce((x, y) => x + (y - m) ** 2, 0) / (r.length - 1);
  return Math.sqrt(v);
}
