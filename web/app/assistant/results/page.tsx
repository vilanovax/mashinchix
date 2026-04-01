import Link from "next/link";
import { RequireAuth } from "@/components/auth/require-auth";
import { AssistantResultsView } from "./results-view";

export default function AssistantResultsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 py-10 dark:bg-zinc-950">
      <RequireAuth>
        <div className="mb-8 px-4 text-center">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            پیشنهادها برای شما
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            بر اساس ویزارد و پروفایل ذخیره‌شده (موتور v3)
          </p>
          <Link
            href="/assistant"
            className="mt-3 inline-block text-sm text-violet-600 hover:underline"
          >
            ویرایش ویزارد
          </Link>
        </div>
        <AssistantResultsView />
      </RequireAuth>
    </div>
  );
}
