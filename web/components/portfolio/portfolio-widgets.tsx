"use client";

import { Card } from "@/components/ui/card";
import { MiniPortfolioChart } from "@/components/charts/mini-line";
import {
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

const allocation = [
  { name: "سدان", value: 35, color: "#8b5cf6" },
  { name: "شاسی", value: 28, color: "#10b981" },
  { name: "هچ‌بک", value: 22, color: "#0ea5e9" },
  { name: "نقد", value: 15, color: "#a1a1aa" },
];

export function PortfolioValueChart() {
  return (
    <Card title="ارزش سبد در زمان" subtitle="Summary first — بعد جزئیات">
      <MiniPortfolioChart />
    </Card>
  );
}

export function AllocationPieChart() {
  return (
    <Card title="تخصیص">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={allocation}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={2}
            >
              {allocation.map((e) => (
                <Cell key={e.name} fill={e.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function SegmentAllocationChart() {
  return (
    <Card title="تخصیص سگمنت">
      <p className="text-xs text-zinc-500">
        heatmap / میله‌ای — نمونه؛ به API سگمنت وصل شود.
      </p>
      <div className="mt-3 flex gap-2">
        {allocation.map((s) => (
          <div
            key={s.name}
            className="flex-1 rounded-lg py-3 text-center text-xs text-white"
            style={{ backgroundColor: s.color }}
          >
            {s.name}
            <div className="font-semibold">{s.value}٪</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function PositionsTable() {
  return (
    <Card title="موقعیت‌ها">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-right text-xs text-zinc-500">
            <tr>
              <th className="pb-2">دارایی</th>
              <th className="pb-2">وزن</th>
              <th className="pb-2">ارزش</th>
            </tr>
          </thead>
          <tbody className="text-zinc-800 dark:text-zinc-200">
            <tr className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="py-2">مزدا ۳</td>
              <td>۱۸٪</td>
              <td>۲۱۶M</td>
            </tr>
            <tr className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="py-2">تویوتا RAV4</td>
              <td>۱۲٪</td>
              <td>۱۴۴M</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function TransactionsTable() {
  return (
    <Card title="تراکنش‌ها">
      <p className="text-xs text-zinc-500">
        جدول از{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
          /portfolio/transactions
        </code>
      </p>
    </Card>
  );
}

export function PerformanceChart() {
  return (
    <Card title="نمودار عملکرد">
      <MiniPortfolioChart />
    </Card>
  );
}

export function RiskMetricsCard() {
  return (
    <Card title="متریک‌های ریسک">
      <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        <li>واریانس پرتفوی: نمونه</li>
        <li>VaR تقریبی: نمونه</li>
      </ul>
    </Card>
  );
}

export function StressTestCard() {
  return (
    <Card title="نتیجهٔ استرس">
      <BadgeInline text="سناریو: رکود — بقا ~۸۲٪" />
    </Card>
  );
}

export function EfficientFrontierChart() {
  return (
    <Card title="مرز کارا">
      <p className="text-xs text-zinc-500">
        نمودار پرتوی کارا پس از اتصال به endpoint بهینه‌سازی.
      </p>
    </Card>
  );
}

function BadgeInline({ text }: { text: string }) {
  return (
    <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      {text}
    </span>
  );
}
