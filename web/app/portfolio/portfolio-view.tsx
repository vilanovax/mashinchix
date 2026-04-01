"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorPanel } from "@/components/ui/query-states";
import { MiniPortfolioChart } from "@/components/charts/mini-line";
import { ProgressBar } from "@/components/ui/progress";
import {
  usePortfolioState,
  usePortfolioHistory,
  usePortfolioTransactions,
  usePortfolioPerformance,
} from "@/lib/hooks/use-portfolio";
import { useSessionOrDevUserId } from "@/lib/use-resolved-user-id";
import { fmtIRR, fmtRatioAsPct } from "@/lib/format";
import {
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

const PIE_COLORS = ["#8b5cf6", "#10b981", "#0ea5e9", "#f59e0b", "#ec4899", "#a1a1aa"];

export function PortfolioView() {
  const devId = useSessionOrDevUserId();
  const stateQ = usePortfolioState(devId);
  const historyQ = usePortfolioHistory(devId, 90);
  const txQ = usePortfolioTransactions(devId, 80);
  const perfQ = usePortfolioPerformance(devId);

  if (stateQ.isError) {
    return (
      <AppShell title="سبد سرمایه‌گذاری">
        <ErrorPanel
          message={stateQ.error?.message ?? "خطا"}
          retry={() => void stateQ.refetch()}
        />
      </AppShell>
    );
  }

  const state = stateQ.data as
    | {
        totalValue?: number;
        cash?: number;
        invested?: number;
        return30d?: number | null;
        sharpe?: number | null;
        drawdown?: number | null;
        positions?: { asset?: string; weight?: number; value?: number }[];
      }
    | undefined;

  const perf = perfQ.data as
    | {
        totalReturn?: number | null;
        sharpe?: number | null;
        maxDrawdown?: number | null;
        volatility?: number | null;
      }
    | undefined;

  const hist = Array.isArray(historyQ.data)
    ? (historyQ.data as { snapshotDate: string; totalValue: number }[])
    : [];

  const chartData =
    hist.length > 1
      ? [...hist]
          .reverse()
          .map((h) => ({
            x: new Intl.DateTimeFormat("fa-IR", {
              month: "short",
              day: "numeric",
            }).format(new Date(h.snapshotDate)),
            y: h.totalValue,
          }))
      : undefined;

  const pieData =
    state?.positions?.map((p, i) => ({
      name: p.asset ?? `—${i}`,
      value: Math.round((p.weight ?? 0) * 1000) / 10,
    })) ?? [];

  const txs = Array.isArray(txQ.data) ? txQ.data : [];

  const loading = stateQ.isLoading;

  return (
    <AppShell title="سبد سرمایه‌گذاری">
      <div className="mx-auto max-w-6xl space-y-6">
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            خلاصه
          </p>
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="ارزش سبد در زمان" subtitle="از /portfolio/history">
                <MiniPortfolioChart data={chartData} />
                <p className="mt-2 text-xs text-zinc-500">
                  ارزش فعلی: {fmtIRR(state?.totalValue)} تومان
                </p>
              </Card>
              <Card title="خلاصهٔ ریسک و بازده" subtitle="state + performance">
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between">
                    <span className="text-zinc-500">بازده ۳۰روز</span>
                    <span>{fmtRatioAsPct(state?.return30d ?? null)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-zinc-500">بازده کل (سری)</span>
                    <span>{fmtRatioAsPct(perf?.totalReturn ?? null)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-zinc-500">شارپ</span>
                    <span className="tabular-nums">
                      {perf?.sharpe != null
                        ? perf.sharpe.toFixed(2)
                        : state?.sharpe != null
                          ? state.sharpe.toFixed(2)
                          : "—"}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-zinc-500">نوسان تخمینی</span>
                    <span>{fmtRatioAsPct(perf?.volatility ?? null)}</span>
                  </li>
                </ul>
              </Card>
            </div>
          )}
        </section>

        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            تخصیص
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="تخصیص (وزن)">
              {pieData.length ? (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={2}
                      >
                        {pieData.map((e, i) => (
                          <Cell
                            key={e.name}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">موقعیتی برای نمودار نیست.</p>
              )}
            </Card>
            <Card title="نوار وزن">
              {state?.positions?.length ? (
                <div className="space-y-3">
                  {state.positions.slice(0, 8).map((p, i) => {
                    const pct =
                      p.weight != null && p.weight <= 1
                        ? p.weight * 100
                        : (p.weight ?? 0);
                    return (
                      <div key={`${p.asset}-${i}`}>
                        <div className="flex justify-between text-xs text-zinc-500">
                          <span>{p.asset}</span>
                          <span>{fmtRatioAsPct(p.weight ?? null)}</span>
                        </div>
                        <ProgressBar value={Math.min(100, pct)} tone="neutral" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">موقعیت خالی است.</p>
              )}
            </Card>
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            جداول
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
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
                    {(state?.positions?.length ? state.positions : []).map(
                      (p, i) => (
                        <tr
                          key={`${p.asset}-${i}`}
                          className="border-t border-zinc-100 dark:border-zinc-800"
                        >
                          <td className="py-2">{p.asset}</td>
                          <td className="tabular-nums">
                            {fmtRatioAsPct(p.weight ?? null)}
                          </td>
                          <td className="tabular-nums">
                            {fmtIRR(p.value)} تومان
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
                {!state?.positions?.length && (
                  <p className="mt-2 text-sm text-zinc-500">ردیفی نیست.</p>
                )}
              </div>
            </Card>
            <Card title="تراکنش‌ها">
              {txQ.isLoading ? (
                <CardSkeleton />
              ) : txQ.isError ? (
                <p className="text-xs text-rose-600">{txQ.error.message}</p>
              ) : txs.length ? (
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white text-zinc-500 dark:bg-zinc-950">
                      <tr>
                        <th className="pb-2 text-right">نوع</th>
                        <th className="pb-2">مبلغ</th>
                        <th className="pb-2">زمان</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txs.map(
                        (
                          row: {
                            id: string;
                            type: string;
                            amount: number;
                            executedAt: string;
                          },
                        ) => (
                          <tr
                            key={row.id}
                            className="border-t border-zinc-100 dark:border-zinc-800"
                          >
                            <td className="py-1.5">{row.type}</td>
                            <td className="tabular-nums">
                              {fmtIRR(row.amount)}
                            </td>
                            <td>
                              {new Intl.DateTimeFormat("fa-IR").format(
                                new Date(row.executedAt),
                              )}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">تراکنشی ثبت نشده.</p>
              )}
            </Card>
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            ریسک
          </p>
          <Card title="متریک‌های ریسک (دستیابی)">
            <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <li>
                افت از قله:{" "}
                {perf?.maxDrawdown != null
                  ? fmtRatioAsPct(-Math.abs(perf.maxDrawdown))
                  : fmtRatioAsPct(state?.drawdown ?? null)}
              </li>
              <li>نقد: {fmtIRR(state?.cash)} · سرمایه‌گذاری: {fmtIRR(state?.invested)}</li>
            </ul>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
