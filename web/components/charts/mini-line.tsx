"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

const demo = [
  { x: "۱", y: 100 },
  { x: "۲", y: 102 },
  { x: "۳", y: 101 },
  { x: "۴", y: 105 },
  { x: "۵", y: 108 },
  { x: "۶", y: 112 },
];

function normalizeSeries(
  points: { x: string; y: number }[],
): { x: string; y: number }[] {
  if (points.length < 2) return demo;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  return points.map((p) => ({
    x: p.x,
    y: 100 + ((p.y - min) / span) * 20,
  }));
}

/** اگر `data` بدهید از تاریخچهٔ ارزش سبد استفاده می‌شود؛ وگرنه دمو */
export function MiniPortfolioChart({
  data,
}: {
  data?: { x: string; y: number }[];
}) {
  const chartData = data?.length ? normalizeSeries(data) : demo;
  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <XAxis dataKey="x" hide />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(v) => [`${v}`, "ارزش نسبی"]}
          />
          <Area
            type="monotone"
            dataKey="y"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
