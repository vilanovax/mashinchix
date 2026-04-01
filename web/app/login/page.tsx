import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <Suspense
        fallback={<p className="text-sm text-zinc-500">بارگذاری…</p>}
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
