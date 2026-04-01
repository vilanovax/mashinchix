"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-context";
import {
  postRecommendationsV3,
  type RecommendV3Item,
} from "@/lib/recommendations";

export function AssistantResultsView() {
  const { user } = useAuth();
  const userId = user?.id;

  const q = useQuery({
    queryKey: ["recommendations", "v3", userId],
    queryFn: () =>
      postRecommendationsV3({ userId: userId as string, limit: 12 }),
    enabled: !!userId,
  });

  if (!userId) {
    return (
      <p className="text-center text-sm text-zinc-600">کاربر شناسایی نشد.</p>
    );
  }

  if (q.isLoading) {
    return (
      <p className="text-center text-sm text-zinc-500">
        در حال محاسبهٔ پیشنهادها…
      </p>
    );
  }

  if (q.isError) {
    return (
      <div className="mx-auto max-w-lg rounded-xl bg-rose-50 px-4 py-3 text-center text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
        {q.error instanceof Error ? q.error.message : "خطا در دریافت نتایج."}
        <p className="mt-2">
          <Link href="/assistant" className="text-violet-600 hover:underline">
            بازگشت به ویزارد
          </Link>
        </p>
      </div>
    );
  }

  const data = q.data;
  const list: RecommendV3Item[] = data?.results ?? data?.recommendations ?? [];

  if (list.length === 0) {
    return (
      <div className="mx-auto max-w-lg text-center text-sm text-zinc-600">
        <p>با بودجه و فیلتر فعلی خودرویی پیدا نشد.</p>
        <Link
          href="/assistant"
          className="mt-4 inline-block text-violet-600 hover:underline"
        >
          ویرایش ویزارد
        </Link>
      </div>
    );
  }

  const topTwo = list.slice(0, 2);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4">
      <div className="text-center">
        <p className="text-xs text-zinc-500">
          بودجه در محاسبه:{" "}
          {typeof data?.budget === "number"
            ? data.budget.toLocaleString("fa-IR")
            : "—"}{" "}
          تومان · {list.length} پیشنهاد
        </p>
      </div>
      <ul className="space-y-3">
        {list.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
                  #{item.rank}
                </span>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {item.brand} {item.model}{" "}
                  <span className="font-normal text-zinc-500">{item.year}</span>
                </h2>
                {item.marketData?.avgPrice != null ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    میانگین بازار:{" "}
                    {Number(item.marketData.avgPrice).toLocaleString("fa-IR")}{" "}
                    تومان
                  </p>
                ) : null}
                {item.recommendationFinalScore != null ? (
                  <p className="text-xs text-zinc-500">
                    امتیاز نهایی: {item.recommendationFinalScore}
                  </p>
                ) : null}
                {item.explanation?.legacySummary ? (
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {item.explanation.legacySummary}
                  </p>
                ) : null}
              </div>
              <Link
                href={`/cars/${encodeURIComponent(item.id)}`}
                className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                جزئیات
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {topTwo.length >= 2 ? (
        <p className="text-center text-sm">
          <Link
            href={`/compare?a=${encodeURIComponent(topTwo[0]!.id)}&b=${encodeURIComponent(topTwo[1]!.id)}`}
            className="text-violet-600 hover:underline"
          >
            مقایسهٔ دو گزینهٔ اول
          </Link>
        </p>
      ) : null}
      <p className="text-center text-sm">
        <Link href="/cars" className="text-zinc-600 underline dark:text-zinc-400">
          همهٔ خودروها
        </Link>
      </p>
    </div>
  );
}
