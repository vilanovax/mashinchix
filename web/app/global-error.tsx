"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen bg-zinc-50 antialiased dark:bg-zinc-950">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            خطای جدی
          </h1>
          <p className="max-w-md text-center text-sm text-zinc-600 dark:text-zinc-400">
            {error.message || "خطا در روت لایهٔ برنامه"}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white"
          >
            تلاش دوباره
          </button>
        </div>
      </body>
    </html>
  );
}
