import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <AppShell title="تنظیمات و پروفایل">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card title="رفتار و بازخورد">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            ثبت اکشن‌ها و فیدبک تصمیم به API{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">/user/*</code>.
          </p>
        </Card>
        <Card title="اتصال API">
          <p className="text-xs text-zinc-500">
            متغیر محیطی پیشنهادی:{" "}
            <code>NEXT_PUBLIC_API_URL</code>
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
