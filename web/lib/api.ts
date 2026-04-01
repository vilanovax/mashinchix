const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

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
      "NEXT_PUBLIC_API_URL تنظیم نشده — آدرس API بک‌اند را در .env.local بگذارید.",
    );
  }
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: options?.credentials ?? "include",
    headers: apiHeaders(options?.headers),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `API error ${res.status}: ${text.slice(0, 200) || res.statusText}`,
    );
  }

  return res.json() as Promise<T>;
}
