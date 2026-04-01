"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-6 dark:bg-zinc-950">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        خطایی رخ داد
      </h1>
      <p className="max-w-md text-center text-sm text-zinc-600 dark:text-zinc-400">
        {error.message || "خطای ناشناخته در برنامه"}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        تلاش دوباره
      </button>
    </div>
  );
}
