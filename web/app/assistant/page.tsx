import { RequireAuth } from "@/components/auth/require-auth";
import { CarAssistantWizard } from "@/components/wizard/car-assistant-wizard";

export default function AssistantPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <RequireAuth>
        <div className="border-b border-zinc-200 bg-white/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/80">
          <h1 className="text-center text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            دستیار انتخاب خودرو
          </h1>
          <p className="mt-1 text-center text-xs text-zinc-500">
            مراحل را کامل کنید؛ اولویت‌ها و بودجه ذخیره می‌شود.
          </p>
        </div>
        <CarAssistantWizard />
      </RequireAuth>
    </div>
  );
}
