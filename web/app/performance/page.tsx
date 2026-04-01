import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { MiniPortfolioChart } from "@/components/charts/mini-line";
import { RequireAuth } from "@/components/auth/require-auth";

export default function PerformancePage() {
  return (
    <RequireAuth>
    <AppShell title="عملکرد">
      <div className="mx-auto max-w-4xl space-y-4">
        <Card title="بازده تجمعی">
          <MiniPortfolioChart />
        </Card>
        <div className="grid gap-4 md:grid-cols-3">
          <Card title="شارپ">
            <p className="text-xl font-semibold">۱٫۱۲</p>
          </Card>
          <Card title="حداکثر افت">
            <p className="text-xl font-semibold text-rose-600">−۶٪</p>
          </Card>
          <Card title="٪ برد روز">
            <p className="text-xl font-semibold">۵۸٪</p>
          </Card>
        </div>
      </div>
    </AppShell>
    </RequireAuth>
  );
}
