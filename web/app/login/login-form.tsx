"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";

export function LoginForm() {
  const { login, status } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await login(email, password);
      router.replace(sp.get("from") || "/dashboard");
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "ورود ناموفق");
    }
  }

  if (status === "authenticated") {
    router.replace("/dashboard");
    return (
      <p className="text-center text-sm text-zinc-500">در حال هدایت…</p>
    );
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="mx-auto w-full max-w-sm space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          ورود
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          کوکی HTTP-only روی دامنهٔ API تنظیم می‌شود؛ باید CORS و{' '}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">credentials</code>{' '}
          فعال باشد.
        </p>
      </div>
      {err && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          {err}
        </p>
      )}
      <label className="block text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">ایمیل</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">رمز</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>
      <button
        type="submit"
        className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        ورود
      </button>
      <p className="text-center text-xs text-zinc-500">
        حساب ندارید؟{" "}
        <Link href="/register" className="text-violet-600 hover:underline">
          ثبت‌نام
        </Link>
      </p>
    </form>
  );
}
