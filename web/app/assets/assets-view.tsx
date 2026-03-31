"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorPanel } from "@/components/ui/query-states";
import {
  useCarsList,
  usePublicCarIntelligence,
  usePublicCarPrediction,
  usePublicCarSignals,
} from "@/lib/hooks/use-cars";
import Link from "next/link";

type CarRow = {
  id: string;
  brand: string;
  model: string;
  segment?: string | null;
};

export function AssetsView() {
  const cars = useCarsList(40);
  const [focusId, setFocusId] = useState<string | null>(null);
  const intel = usePublicCarIntelligence(focusId ?? "");
  const pred = usePublicCarPrediction(focusId ?? "");
  const sig = usePublicCarSignals(focusId ?? "");

  if (cars.isError) {
    return (
      <AppShell title="دارایی‌ها">
        <ErrorPanel
          message={cars.error?.message ?? "خطا"}
          retry={() => void cars.refetch()}
        />
      </AppShell>
    );
  }

  const rows = Array.isArray(cars.data)
    ? (cars.data as CarRow[])
    : [];

  return (
    <AppShell title="دارایی‌ها">
      <div className="mx-auto max-w-5xl space-y-6">
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            خلاصه
          </p>
          <Card title="دارایی‌های خودرو (API داخلی /cars)">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              مسیرهای عمومی{" "}
              <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
                /public/cars/:id/*
              </code>{" "}
              در صورت نیاز به کلید در env تنظیم شده‌اند.
            </p>
          </Card>
        </section>

        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            جدول دارایی‌ها
          </p>
          <Card title="لیست">
            {cars.isLoading ? (
              <CardSkeleton />
            ) : rows.length ? (
              <div className="max-h-[28rem] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white text-xs text-zinc-500 dark:bg-zinc-950">
                    <tr>
                      <th className="pb-2 text-right">خودرو</th>
                      <th className="pb-2">سگمنت</th>
                      <th className="pb-2">جزئیات</th>
                      <th className="pb-2">هوش عمومی</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr
                        key={c.id}
                        className="border-t border-zinc-100 dark:border-zinc-800"
                      >
                        <td className="py-2">
                          {c.brand} {c.model}
                        </td>
                        <td className="text-xs text-zinc-500">
                          {c.segment ?? "—"}
                        </td>
                        <td>
                          <Link
                            href={`/cars/${encodeURIComponent(c.id)}`}
                            className="text-violet-600 hover:underline"
                          >
                            صفحه خودرو
                          </Link>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="text-xs text-zinc-700 underline dark:text-zinc-300"
                            onClick={() =>
                              setFocusId((id) => (id === c.id ? null : c.id))
                            }
                          >
                            {focusId === c.id ? "بستن" : "نمایش"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">خودرویی نیست.</p>
            )}
          </Card>
        </section>

        {focusId && (
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              دادهٔ خام (public)
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <Card title="Intelligence">
                {intel.isLoading ? (
                  <CardSkeleton />
                ) : intel.isError ? (
                  <p className="text-xs text-rose-600">{intel.error.message}</p>
                ) : (
                  <pre className="max-h-48 overflow-auto text-[10px] text-zinc-600 dark:text-zinc-400">
                    {JSON.stringify(intel.data, null, 0).slice(0, 2000)}
                  </pre>
                )}
              </Card>
              <Card title="Prediction">
                {pred.isLoading ? (
                  <CardSkeleton />
                ) : pred.isError ? (
                  <p className="text-xs text-rose-600">{pred.error.message}</p>
                ) : (
                  <pre className="max-h-48 overflow-auto text-[10px] text-zinc-600 dark:text-zinc-400">
                    {JSON.stringify(pred.data, null, 0).slice(0, 2000)}
                  </pre>
                )}
              </Card>
              <Card title="Signals">
                {sig.isLoading ? (
                  <CardSkeleton />
                ) : sig.isError ? (
                  <p className="text-xs text-rose-600">{sig.error.message}</p>
                ) : (
                  <pre className="max-h-48 overflow-auto text-[10px] text-zinc-600 dark:text-zinc-400">
                    {JSON.stringify(sig.data, null, 0).slice(0, 2000)}
                  </pre>
                )}
              </Card>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
