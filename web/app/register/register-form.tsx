"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";

export function RegisterForm() {
  const { register, status } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await register(email, password, name.trim() || undefined);
      router.replace("/dashboard");
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "ثبت‌نام ناموفق");
    }
  }

  if (status === "authenticated") {
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
          ثبت‌نام
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          حداقل ۸ کاراکتر برای رمز.
        </p>
      </div>
      {err && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          {err}
        </p>
      )}
      <label className="block text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">نام (اختیاری)</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>
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
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>
      <button
        type="submit"
        className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        ایجاد حساب
      </button>
      <p className="text-center text-xs text-zinc-500">
        قبلاً ثبت کرده‌اید؟{" "}
        <Link href="/login" className="text-violet-600 hover:underline">
          ورود
        </Link>
      </p>
    </form>
  );
}
