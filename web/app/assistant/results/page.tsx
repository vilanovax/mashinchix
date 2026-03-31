import Link from "next/link";

export default function AssistantResultsPage() {
  return (
    <div className="min-h-screen px-6 py-16">
      <p className="text-center text-sm text-zinc-600">
        نتایج ویزارد — پارامتر{" "}
        <code className="rounded bg-zinc-100 px-1">userId</code>
      </p>
      <p className="mt-4 text-center">
        <Link href="/cars" className="text-violet-600 hover:underline">
          لیست خودروها
        </Link>
      </p>
    </div>
  );
}
