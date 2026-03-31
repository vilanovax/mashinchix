import Link from "next/link";

export default async function CarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-screen px-6 py-16">
      <h1 className="text-lg font-semibold">جزئیات خودرو {id}</h1>
      <p className="mt-2 text-sm text-zinc-600">
        نمودار قیمت، پیش‌بینی، امتیازها — طبق MVP
      </p>
      <Link href="/assets" className="mt-4 inline-block text-sm text-violet-600">
        دارایی‌ها
      </Link>
    </div>
  );
}
