"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-context";
import {
  useBehaviorProfile,
  useUserPreferences,
  useUserRiskProfile,
} from "@/lib/hooks/use-user-behavior";
import { useSessionOrDevUserId } from "@/lib/use-resolved-user-id";
import { fmtIRR } from "@/lib/format";

export function SettingsView() {
  const { user } = useAuth();
  const devId = useSessionOrDevUserId();
  const behavior = useBehaviorProfile(devId);
  const prefs = useUserPreferences(devId);
  const risk = useUserRiskProfile(devId);

  return (
    <AppShell title="تنظیمات و پروفایل">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card title="حساب کاربری">
          <dl className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">ایمیل</dt>
              <dd>{user?.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">نام</dt>
              <dd>{user?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">بودجه (کاربر)</dt>
              <dd>
                {typeof user?.budget === "string" && user.budget
                  ? `${fmtIRR(Number(user.budget))} تومان`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">ریسک</dt>
              <dd>{String(user?.riskLevel ?? "—")}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-zinc-500">
            تم/ارز/زمان‌بندی از طریق{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              PATCH /auth/settings
            </code>{" "}
            (نیاز به UI جدا).
          </p>
        </Card>

        <Card title="پروفایل ریسک (رفتار)">
          {risk.isLoading ? (
            <p className="text-sm text-zinc-500">در حال بارگذاری…</p>
          ) : risk.isError ? (
            <p className="text-sm text-rose-600">{risk.error.message}</p>
          ) : (
            <pre className="max-h-40 overflow-auto text-[11px] text-zinc-600 dark:text-zinc-400">
              {JSON.stringify(risk.data, null, 2)?.slice(0, 1200)}
            </pre>
          )}
        </Card>

        <Card title="ترجیحات / افق سرمایه‌گذاری">
          {prefs.isLoading ? (
            <p className="text-sm text-zinc-500">در حال بارگذاری…</p>
          ) : (
            <pre className="max-h-40 overflow-auto text-[11px] text-zinc-600 dark:text-zinc-400">
              {JSON.stringify(prefs.data, null, 2)?.slice(0, 1200)}
            </pre>
          )}
        </Card>

        <Card title="رفتار و هدف‌ها">
          {behavior.isLoading ? (
            <p className="text-sm text-zinc-500">در حال بارگذاری…</p>
          ) : (
            <pre className="max-h-40 overflow-auto text-[11px] text-zinc-600 dark:text-zinc-400">
              {JSON.stringify(behavior.data, null, 2)?.slice(0, 1200)}
            </pre>
          )}
        </Card>

        <Card title="اعلان‌ها و سیاست اجرا">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              UserSettings.notificationsEnabled
            </code>{" "}
            و قوانین اجرا در فاز بعد به این صفحه وصل می‌شوند.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
