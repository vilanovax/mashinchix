import Link from "next/link";

export default function AssistantPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16 dark:bg-zinc-950">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          دستیار انتخاب خودرو
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          ویزارد مرحله‌ای طبق `docs/mvp-user-flow-ui.md` — در حال اتصال به API.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block text-sm text-violet-600 hover:underline"
        >
          بازگشت به داشبورد
        </Link>
      </div>
    </div>
  );
}
