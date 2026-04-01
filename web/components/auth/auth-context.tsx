"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthUser } from "@/lib/auth";
import {
  authLogin,
  authLogout,
  authMe,
  authRefresh,
  authRegister,
} from "@/lib/auth";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  /** بارگذاری مجدد کاربر از سرور (مثلاً بعد از ویزارد) */
  reloadUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const loadMe = useCallback(async () => {
    try {
      const { user: u } = await authMe();
      setUser(u);
      setStatus("authenticated");
    } catch {
      try {
        await authRefresh({});
        const { user: u2 } = await authMe();
        setUser(u2);
        setStatus("authenticated");
      } catch {
        setUser(null);
        setStatus("unauthenticated");
      }
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      await authLogin(email, password);
      queryClient.clear();
      await loadMe();
    },
    [loadMe, queryClient],
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      await authRegister({ email, password, name });
      queryClient.clear();
      await loadMe();
    },
    [loadMe, queryClient],
  );

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
    setStatus("unauthenticated");
    queryClient.clear();
  }, [queryClient]);

  const refreshSession = useCallback(async () => {
    await authRefresh({});
    await loadMe();
  }, [loadMe]);

  const reloadUser = useCallback(async () => {
    await loadMe();
  }, [loadMe]);

  const value = useMemo(
    () => ({
      user,
      status,
      login,
      register,
      logout,
      refreshSession,
      reloadUser,
    }),
    [user, status, login, register, logout, refreshSession, reloadUser],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth باید زیر AuthProvider باشد");
  }
  return ctx;
}
