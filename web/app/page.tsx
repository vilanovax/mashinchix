import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Mashinchi
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          مشاور سرمایه‌گذاری برای بازار خودرو — داشبورد خلبانی، نه ویترین آگهی.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            ورود به داشبورد
          </Link>
          <Link
            href="/today"
            className="rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            امروز چه کار کنم؟
          </Link>
          <Link
            href="/assistant"
            className="text-sm text-violet-600 hover:underline dark:text-violet-400"
          >
            دستیار انتخاب خودرو (MVP)
          </Link>
        </div>
      </div>
    </div>
  );
}
