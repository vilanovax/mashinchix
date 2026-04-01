"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { authPatchWizard } from "@/lib/auth";
import { useCarsList } from "@/lib/hooks/use-cars";
const USAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "CITY", label: "شهری" },
  { value: "FAMILY", label: "خانوادگی" },
  { value: "TRIP", label: "سفر" },
  { value: "SPORT", label: "اسپرت" },
  { value: "OFFROAD", label: "آفرود" },
  { value: "WORK_RIDEHAIL", label: "کار / اسنپ" },
  { value: "INVESTMENT", label: "سرمایه‌گذاری" },
];

const WEIGHT_LABELS: { key: string; label: string }[] = [
  { key: "economy", label: "مصرف و اقتصاد سوخت" },
  { key: "performance", label: "شتاب و دینامیک" },
  { key: "comfort", label: "راحتی" },
  { key: "ownership", label: "هزینه نگهداری" },
  { key: "market", label: "نقدشوندگی بازار" },
  { key: "prestige", label: "پرستیژ" },
  { key: "reliability", label: "اعتماد / استهلاک" },
];

const STEPS = 6;

function initialWeights(): Record<string, number> {
  const o: Record<string, number> = { risk: 12 };
  for (const { key } of WEIGHT_LABELS) o[key] = 14;
  return o;
}

export function CarAssistantWizard() {
  const router = useRouter();
  const { reloadUser } = useAuth();
  const carsQuery = useCarsList(150);

  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState("");
  const [listingCondition, setListingCondition] = useState<
    "NEW" | "USED" | "EITHER"
  >("EITHER");
  const [holdYears, setHoldYears] = useState("5");
  const [usageTags, setUsageTags] = useState<string[]>(["CITY"]);
  const [weights, setWeights] = useState(initialWeights);
  const [riskLevel, setRiskLevel] = useState<"LOW" | "MEDIUM" | "HIGH">(
    "MEDIUM",
  );
  const [previousCarIds, setPreviousCarIds] = useState<string[]>([]);
  const [carFilter, setCarFilter] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cars = useMemo(() => {
    const raw = (carsQuery.data as { id?: string; brand?: string; model?: string; year?: number }[] | undefined) ?? [];
    const q = carFilter.trim().toLowerCase();
    if (!q) return raw;
    return raw.filter(
      (c) =>
        `${c.brand ?? ""} ${c.model ?? ""} ${c.year ?? ""}`
          .toLowerCase()
          .includes(q),
    );
  }, [carsQuery.data, carFilter]);

  function toggleUsage(v: string) {
    setUsageTags((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  }

  function togglePreviousCar(id: string) {
    setPreviousCarIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function setWeight(key: string, v: number) {
    setWeights((w) => ({ ...w, [key]: Math.max(0, v) }));
  }

  function validateStep(s: number): string | null {
    if (s === 0) {
      const b = Number(budget.replace(/,/g, "").trim());
      if (!Number.isFinite(b) || b <= 0) return "بودجه معتبر وارد کنید (تومان).";
      return null;
    }
    if (s === 1) {
      if (usageTags.length < 1) return "حداقل یک کاربری را انتخاب کنید.";
      return null;
    }
    return null;
  }

  async function submit() {
    const b = Number(budget.replace(/,/g, "").trim());
    if (!Number.isFinite(b) || b <= 0) {
      setErr("بودجه معتبر نیست.");
      return;
    }
    if (usageTags.length < 1) {
      setErr("کاربری انتخاب نشده.");
      return;
    }
    setErr("");
    setSubmitting(true);
    try {
      const wObj: Record<string, number> = {};
      for (const { key } of WEIGHT_LABELS) {
        wObj[key] = weights[key] ?? 1;
      }
      wObj.risk = weights.risk ?? 0.12;

      const hy = holdYears.trim()
        ? Number(holdYears.replace(/,/g, ""))
        : undefined;

      await authPatchWizard({
        budget: Math.round(b),
        listingCondition,
        holdYears:
          hy != null && Number.isFinite(hy) ? Math.round(hy) : undefined,
        usageTags,
        preferences: { weights: wObj },
        riskLevel,
        previousCarIds,
      });
      await reloadUser();
      router.push("/assistant/results");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ذخیره نشد.");
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    const v = validateStep(step);
    if (v) {
      setErr(v);
      return;
    }
    setErr("");
    if (step < STEPS - 1) setStep(step + 1);
    else void submit();
  }

  function back() {
    setErr("");
    if (step > 0) setStep(step - 1);
  }

  const budgetNum = Number(budget.replace(/,/g, "").trim());

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          مرحله {step + 1} از {STEPS}
        </p>
        <Link
          href="/dashboard"
          className="text-xs text-violet-600 hover:underline"
        >
          انصراف
        </Link>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full bg-violet-600 transition-all dark:bg-violet-400"
          style={{ width: `${((step + 1) / STEPS) * 100}%` }}
        />
      </div>

      {err ? (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          {err}
        </p>
      ) : null}

      <div className="mt-8 space-y-6">
        {step === 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              بودجه و نگهداری
            </h2>
            <label className="block text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                بودجه حداکثر (تومان)
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="مثلاً ۱۵۰۰۰۰۰۰۰۰"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <fieldset className="space-y-2">
              <legend className="text-sm text-zinc-600 dark:text-zinc-400">
                نوع آگهی
              </legend>
              {(
                [
                  ["NEW", "صفر کیلومتر"],
                  ["USED", "کارکرده"],
                  ["EITHER", "فرقی ندارد"],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="lc"
                    checked={listingCondition === v}
                    onChange={() => setListingCondition(v)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label className="block text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                چند سال نگه می‌دارید؟ (اختیاری)
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={holdYears}
                onChange={(e) => setHoldYears(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
              />
            </label>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              کاربری (چند مورد)
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {USAGE_OPTIONS.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <input
                    type="checkbox"
                    checked={usageTags.includes(value)}
                    onChange={() => toggleUsage(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-5">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              اولویت‌ها (بعداً نرمال می‌شود)
            </h2>
            {WEIGHT_LABELS.map(({ key, label }) => (
              <label key={key} className="block text-sm">
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>{label}</span>
                  <span>{weights[key] ?? 0}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(weights[key] ?? 0)}
                  onChange={(e) => setWeight(key, Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </label>
            ))}
            <label className="block text-sm">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>جریمه ریسک (بیشتر = حساس‌تر به ریسک)</span>
                <span>{Math.round(weights.risk ?? 0)}</span>
              </div>
              <input
                type="range"
                min={5}
                max={35}
                value={Math.round(weights.risk ?? 12)}
                onChange={(e) => setWeight("risk", Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              تحمل ریسک
            </h2>
            {(
              [
                ["LOW", "کم"],
                ["MEDIUM", "متوسط"],
                ["HIGH", "زیاد"],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="rl"
                  checked={riskLevel === v}
                  onChange={() => setRiskLevel(v)}
                />
                {label}
              </label>
            ))}
          </section>
        )}

        {step === 4 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              خودروهای قبلی (اختیاری)
            </h2>
            <input
              type="search"
              value={carFilter}
              onChange={(e) => setCarFilter(e.target.value)}
              placeholder="جستجوی برند یا مدل…"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
            {carsQuery.isLoading ? (
              <p className="text-sm text-zinc-500">در حال بارگذاری لیست…</p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
                {cars.slice(0, 80).map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={!!c.id && previousCarIds.includes(c.id)}
                        onChange={() => c.id && togglePreviousCar(c.id)}
                      />
                      <span>
                        {c.brand} {c.model} {c.year}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {step === 5 && (
          <section className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              خلاصه و ثبت
            </h2>
            <ul className="space-y-1 rounded-xl bg-zinc-100 p-4 dark:bg-zinc-900/60">
              <li>
                بودجه:{" "}
                <strong>
                  {Number.isFinite(budgetNum) ? budgetNum.toLocaleString("fa-IR") : "—"}
                </strong>{" "}
                تومان
              </li>
              <li>نوع آگهی: {listingCondition}</li>
              <li>نگهداری: {holdYears || "—"} سال</li>
              <li>کاربری: {usageTags.join("، ")}</li>
              <li>ریسک: {riskLevel}</li>
              <li>خودروهای قبلی: {previousCarIds.length} مورد</li>
            </ul>
            <p className="text-xs text-zinc-500">
              با تأیید، پروفایل در حساب شما ذخیره و به نتایج هدایت می‌شوید.
            </p>
          </section>
        )}
      </div>

      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={back}
          disabled={step === 0 || submitting}
          className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium disabled:opacity-40 dark:border-zinc-700"
        >
          قبلی
        </button>
        <button
          type="button"
          onClick={() => void next()}
          disabled={submitting}
          className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {step === STEPS - 1
            ? submitting
              ? "در حال ذخیره…"
              : "پایان و ذخیره"
            : "بعدی"}
        </button>
      </div>
    </div>
  );
}
