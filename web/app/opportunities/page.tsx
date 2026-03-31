import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const rows = [
  "بهترین فرصت خرید",
  "دارایی‌های کم‌ارزش",
  "شکست مومنتوم",
  "سرمایه‌گذاری کم‌ریسک",
  "نقدشوندگی بالا",
  "کاندیدای شارپ",
];

export default function OpportunitiesPage() {
  return (
    <AppShell title="فرصت‌ها">
      <div className="mx-auto max-w-3xl space-y-3">
        {rows.map((t) => (
          <Card key={t} title={t}>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">نمونه</span>
              <Badge variant="success">از API intelligence</Badge>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
