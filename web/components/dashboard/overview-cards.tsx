import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { MiniPortfolioChart } from "@/components/charts/mini-line";
import Link from "next/link";

export function PortfolioValueCard() {
  return (
    <Card title="ارزش سبد" subtitle="جمع دارایی‌ها + نقد">
      <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        ۱٬۲۰۰٬۰۰۰٬۰۰۰
        <span className="text-base font-normal text-zinc-500"> تومان</span>
      </p>
      <MiniPortfolioChart />
      <p className="mt-2 text-xs text-zinc-500">
        دادهٔ نمونه — اتصال به{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">/portfolio/*</code>
      </p>
    </Card>
  );
}

export function MarketCycleCard() {
  return (
    <Card title="چرخهٔ بازار">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          وضعیت فعلی
        </span>
        <Badge variant="warning">صعودی محتاط</Badge>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        خلاصه در بالای صفحه؛ جزئیات چرخه در «بازار».
      </p>
    </Card>
  );
}

export function RiskLevelCard() {
  return (
    <Card title="ریسک سبد">
      <div className="flex items-center justify-between">
        <Badge variant="warning">متوسط</Badge>
        <span className="text-xs text-zinc-500">هدف: کم‌ریسک‌تر در ۳۰ روز</span>
      </div>
      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>تقریبی نسبت به هدف</span>
          <span>۶۵٪</span>
        </div>
        <ProgressBar value={65} tone="risk" />
      </div>
    </Card>
  );
}

export function PerformanceCard() {
  return (
    <Card title="عملکرد">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-zinc-500">بازده ۳۰ روز</p>
          <p className="font-semibold text-emerald-600 dark:text-emerald-400">
            +۸٪
          </p>
        </div>
        <div>
          <p className="text-zinc-500">شارپ</p>
          <p className="font-semibold tabular-nums">۱٫۱۲</p>
        </div>
      </div>
    </Card>
  );
}

export function TopOpportunitiesCard() {
  return (
    <Card
      title="فرصت‌های برتر"
      action={
        <Link
          href="/opportunities"
          className="text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
        >
          همه
        </Link>
      }
    >
      <ul className="space-y-2 text-sm">
        <li className="flex justify-between gap-2">
          <span className="text-zinc-700 dark:text-zinc-300">سدان — مومنتوم</span>
          <Badge variant="success">خرید</Badge>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-zinc-700 dark:text-zinc-300">کم‌ریسک شهری</span>
          <Badge variant="info">نگاه</Badge>
        </li>
      </ul>
    </Card>
  );
}

export function AlertsCard() {
  return (
    <Card
      title="هشدارهای فعال"
      action={
        <Link
          href="/alerts"
          className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
        >
          مدیریت
        </Link>
      }
    >
      <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
        <li>نوسان سگمنت SUV بالاتر از آستانه</li>
        <li>نقدشوندگی دو نماد کاهشی</li>
      </ul>
    </Card>
  );
}

export function StrategyCard() {
  return (
    <Card title="استراتژی فعال">
      <Badge variant="strategy">متعادل — چرخه بازار</Badge>
      <p className="mt-2 text-xs text-zinc-500">
        توضیح کوتاه استراتژی؛ لینک به صفحهٔ استراتژی.
      </p>
      <Link
        href="/strategy"
        className="mt-2 inline-block text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
      >
        جزئیات استراتژی
      </Link>
    </Card>
  );
}

export function DiversificationCard() {
  return (
    <Card title="تنوع سبد">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        امتیاز تنوع: <span className="font-semibold text-zinc-900 dark:text-zinc-100">۰٫۷۲</span>
      </p>
      <ProgressBar value={72} tone="confidence" className="mt-3" />
    </Card>
  );
}

export function CashLevelCard() {
  return (
    <Card title="نقد و تعادل">
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">سهم نقد</span>
        <span className="font-medium tabular-nums">۱۸٪</span>
      </div>
      <ProgressBar value={18} className="mt-3" />
    </Card>
  );
}
