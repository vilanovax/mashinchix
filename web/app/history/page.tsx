import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";

export default function HistoryPage() {
  return (
    <AppShell title="تاریخچهٔ اجرا">
      <div className="mx-auto max-w-3xl">
        <Card title="پلان‌ها و نتایج اجرا">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            جدول زمانی از{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              ExecutionPlan / ExecutionResult
            </code>{" "}
            و اسنپ‌شات سبد.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
