import Link from "next/link";

export default function CarsListPage() {
  return (
    <div className="min-h-screen px-6 py-16">
      <h1 className="text-lg font-semibold">خودروها</h1>
      <p className="mt-2 text-sm text-zinc-600">
        فیلتر و مرتب‌سازی MVP — placeholder
      </p>
      <Link href="/dashboard" className="mt-4 inline-block text-sm text-violet-600">
        داشبورد
      </Link>
    </div>
  );
}
