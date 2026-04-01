import { apiFetch } from "@/lib/api";

export type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
  settings?: unknown;
  profile?: unknown;
  [key: string]: unknown;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export async function authRegister(body: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function authLogin(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function authLogout(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/auth/logout", {
    method: "POST",
  });
}

export async function authRefresh(body?: {
  refreshToken?: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export async function authMe(): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>("/auth/me");
}

export async function authPatchSettings(
  patch: Record<string, unknown>,
): Promise<unknown> {
  return apiFetch("/auth/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export type WizardPayload = {
  budget: number;
  listingCondition: "NEW" | "USED" | "EITHER";
  holdYears?: number;
  usageTags: string[];
  preferences: {
    weights: Record<string, number>;
  };
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  previousCarIds: string[];
};

export async function authPatchWizard(
  body: WizardPayload,
): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>("/auth/wizard", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
