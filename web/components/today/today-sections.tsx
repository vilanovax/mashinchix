import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";

export function MarketSummaryCard() {
  return (
    <Card title="وضعیت بازار">
      <div className="flex flex-wrap gap-2">
        <Badge variant="warning">صعودی محتاط</Badge>
        <Badge variant="info">اطمینان مدل ۷۸٪</Badge>
      </div>
    </Card>
  );
}

export function PortfolioSummaryCard() {
  return (
    <Card title="سبد">
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <p className="text-zinc-500">ارزش</p>
          <p className="font-semibold tabular-nums">۱٫۲B تومان</p>
        </div>
        <div>
          <p className="text-zinc-500">ریسک</p>
          <Badge variant="warning">متوسط</Badge>
        </div>
        <div>
          <p className="text-zinc-500">اطمینان</p>
          <p className="font-semibold">۷۸٪</p>
        </div>
      </div>
    </Card>
  );
}

export function RecommendedActionsList() {
  const items = [
    "تعادل‌بندی سبد",
    "خرید مزدا ۳",
    "کاهش قرارگیری در SUV",
    "افزایش نقد به ۱۸٪",
  ];
  return (
    <Card title="پیشنهادهای امروز">
      <ol className="list-inside list-decimal space-y-2 text-sm text-zinc-800 dark:text-zinc-200">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
    </Card>
  );
}

export function ExpectedImpactCard() {
  return (
    <Card title="اثر مورد انتظار">
      <ul className="space-y-2 text-sm">
        <li className="flex justify-between">
          <span className="text-zinc-500">بازده</span>
          <span className="font-medium text-emerald-600">+۴٫۲٪</span>
        </li>
        <li className="flex justify-between">
          <span className="text-zinc-500">ریسک</span>
          <span className="font-medium text-emerald-600">−۱٫۸٪</span>
        </li>
        <li className="flex justify-between">
          <span className="text-zinc-500">شارپ</span>
          <span className="font-medium">+۰٫۲۲</span>
        </li>
      </ul>
    </Card>
  );
}

export function WarningsCard() {
  return (
    <Card title="هشدارها">
      <ul className="list-disc space-y-1 ps-4 text-sm text-amber-800 dark:text-amber-200">
        <li>نوسان سگمنت SUV بالاست</li>
      </ul>
    </Card>
  );
}

export function OpportunitiesCard() {
  return (
    <Card title="فرصت‌ها">
      <p className="text-sm text-emerald-800 dark:text-emerald-200">
        مومنتوم سگمنت سدان در حال تقویت است.
      </p>
    </Card>
  );
}

export function ConfidenceCard() {
  return (
    <Card title="اطمینان مشاور">
      <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
        ترکیب سیگنال‌های بازار و پرتفوی
      </p>
      <ProgressBar value={78} tone="confidence" />
    </Card>
  );
}

export function AdvisorSummaryText() {
  return (
    <Card title="خلاصهٔ مشاور">
      <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        امروز تمرکز روی کنترل ریسک سگمنت‌های پرنوسان و حفظ شارپ با نقد هدفمند است.
        ابتدا تعادل‌بندی، سپس ورود تدریجی به فرصت‌های تاییدشده.
      </p>
    </Card>
  );
}
