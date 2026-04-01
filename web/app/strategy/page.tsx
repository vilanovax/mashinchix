import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RequireAuth } from "@/components/auth/require-auth";

export default function StrategyPage() {
  return (
    <RequireAuth>
    <AppShell title="استراتژی">
      <div className="mx-auto max-w-3xl space-y-4">
        <Card title="استراتژی فعال">
          <Badge variant="strategy">متعادل + چرخه</Badge>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            توضیح کوتاه، سپس نمودار و تاریخچهٔ تغییر — از API strategy / decision.
          </p>
        </Card>
      </div>
    </AppShell>
    </RequireAuth>
  );
}
