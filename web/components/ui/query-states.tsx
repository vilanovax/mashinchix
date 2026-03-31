"use client";

import type { ReactNode } from "react";
import { Card } from "./card";

export function ErrorPanel({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <Card title="خطا در بارگذاری">
      <p className="text-sm text-rose-700 dark:text-rose-300">{message}</p>
      {retry && (
        <button
          type="button"
          onClick={retry}
          className="mt-3 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          تلاش دوباره
        </button>
      )}
    </Card>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: ReactNode;
}) {
  return (
    <Card title={title}>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {hint ?? "داده‌ای نیست یا userId تنظیم نشده است."}
      </p>
    </Card>
  );
}

export function NeedUserIdHint() {
  return (
    <EmptyState
      title="شناسه کاربر"
      hint={
        <>
          در URL پارامتر{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            ?userId=
          </code>{" "}
          بگذارید یا{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            NEXT_PUBLIC_DEFAULT_USER_ID
          </code>{" "}
          را در env تنظیم کنید.
        </>
      }
    />
  );
}
