function resolveApiBaseUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  // بدون .env.local در `next dev` به همان پورت پیش‌فرض نمونهٔ api می‌رویم
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3001";
  }
  return "";
}

const API_URL = resolveApiBaseUrl();

function apiHeaders(init?: HeadersInit): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init && typeof init === "object" && !(init instanceof Headers)
      ? (init as Record<string, string>)
      : {}),
  };
  const key = process.env.NEXT_PUBLIC_API_KEY?.trim();
  if (key) {
    h["X-Api-Key"] = key;
  }
  if (init instanceof Headers) {
    init.forEach((v, k) => {
      h[k] = v;
    });
    return h;
  }
  return { ...h, ...(init as Record<string, string> | undefined) };
}

export function getApiBaseUrl(): string {
  return API_URL;
}

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  if (!API_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_URL تنظیم نشده. در ریشهٔ web فایل .env.local بسازید (مثال: web/.env.example) یا در استقرار مقداردهی کنید.",
    );
  }
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      credentials: options?.credentials ?? "include",
      headers: apiHeaders(options?.headers),
      cache: "no-store",
    });
  } catch {
    const base = API_URL;
    const hint =
      process.env.NODE_ENV === "development"
        ? ` بک‌اند را اجرا کنید؛ مثال: cd api && PORT=3001 npm run start:dev — آدرس فعلی: ${base}`
        : ` آدرس API: ${base}`;
    throw new Error(
      `سرور API در دسترس نیست (اتصال برقرار نشد).${hint} اگر پورت API عوض شده، NEXT_PUBLIC_API_URL در web/.env.local را هماهنگ کنید.`,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `API error ${res.status}: ${text.slice(0, 200) || res.statusText}`,
    );
  }

  return res.json() as Promise<T>;
}
