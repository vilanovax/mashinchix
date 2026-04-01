export type NavItem = {
  href: string;
  label: string;
  description?: string;
};

export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "داشبورد" },
  { href: "/today", label: "اقدام امروز" },
  { href: "/portfolio", label: "سبد" },
  { href: "/market", label: "بازار" },
  { href: "/assets", label: "دارایی‌ها" },
  { href: "/opportunities", label: "فرصت‌ها" },
  { href: "/alerts", label: "هشدارها" },
  { href: "/notifications", label: "اعلان‌ها" },
  { href: "/events", label: "رویدادها" },
  { href: "/strategy", label: "استراتژی" },
  { href: "/performance", label: "عملکرد" },
  { href: "/history", label: "تاریخچه اجرا" },
  { href: "/settings", label: "تنظیمات" },
];
