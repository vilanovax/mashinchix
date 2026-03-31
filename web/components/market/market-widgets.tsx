import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function MarketCycleCard() {
  return (
    <Card title="چرخهٔ بازار">
      <Badge variant="warning">پایدار متمایل به صعود</Badge>
    </Card>
  );
}

export function SegmentIndexChart() {
  return (
    <Card title="شاخص سگمنت‌ها">
      <p className="text-xs text-zinc-500">نمودار خطی — اتصال به analytics</p>
    </Card>
  );
}

export function MomentumHeatmap() {
  return (
    <Card title="نقشهٔ مومنتوم">
      <div className="grid grid-cols-4 gap-1 text-center text-[10px] text-white">
        {["سدان", "SUV", "هچ", "لوکس"].map((s, i) => (
          <div
            key={s}
            className="rounded py-4"
            style={{
              backgroundColor: `rgba(16, 185, 129, ${0.35 + i * 0.15})`,
            }}
          >
            {s}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function LiquidityHeatmap() {
  return (
    <Card title="نقدشوندگی">
      <p className="text-xs text-zinc-500">heatmap placeholder</p>
    </Card>
  );
}

export function VolatilityHeatmap() {
  return (
    <Card title="نوسان">
      <p className="text-xs text-zinc-500">heatmap placeholder</p>
    </Card>
  );
}

export function MarketFlowsChart() {
  return (
    <Card title="جریان بین سگمنت‌ها">
      <p className="text-xs text-zinc-500">Sankey / flow — بعداً</p>
    </Card>
  );
}

export function TopSegmentsTable() {
  return (
    <Card title="سگمنت‌های برتر">
      <ul className="text-sm text-zinc-700 dark:text-zinc-300">
        <li>۱. سدان کامپکت</li>
        <li>۲. کراس اوور میان‌رده</li>
      </ul>
    </Card>
  );
}

export function MarketAlertsList() {
  return (
    <Card title="هشدارهای بازار">
      <ul className="text-sm text-rose-700 dark:text-rose-300">
        <li>شوک نوسان در SUV</li>
      </ul>
    </Card>
  );
}

export function WorstSegmentsTable() {
  return (
    <Card title="ضعیف‌ترین سگمنت‌ها">
      <ul className="text-sm text-zinc-600 dark:text-zinc-400">
        <li>وانت دیزل (نمونه)</li>
      </ul>
    </Card>
  );
}
