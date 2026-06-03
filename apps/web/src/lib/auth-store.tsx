// 簡單的 auth state — access token 存在記憶體 + tokenStore（給 api-client 用）
// 開啟頁面時自動嘗試 /auth/refresh 拿新 access token（即使重新整理也不會掉登入）
"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "./api-types";
import { apiFetch, tokenStore, type ApiError } from "./api-client";

export interface AuthState {
  accessToken: string | null;
  user: User | null;
  setSession: (token: string, u: User) => void;
  clear: () => void;
  /** true 表示初始 refresh 已嘗試過（不論成敗）*/
  hydrated: boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside <AuthProvider>");
  return v;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const setSession = useCallback((token: string, u: User) => {
    setAccessToken(token);
    tokenStore.set(token);
    setUser(u);
  }, []);
  const clear = useCallback(() => {
    setAccessToken(null);
    tokenStore.set(null);
    setUser(null);
    // 也告訴 BE 撤銷 refresh cookie
    void apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
  }, []);

  // 首次掛載時嘗試用 refresh cookie 換 access token + 拿 /me
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await apiFetch<{ data: { access_token: string } }>("/auth/refresh", {
          method: "POST",
          _skipAuth: true,
        } as RequestInit & { _skipAuth: boolean });
        if (!alive) return;
        tokenStore.set(r.data.access_token);
        const me = await apiFetch<{ data: User }>("/me");
        if (!alive) return;
        setAccessToken(r.data.access_token);
        setUser(me.data);
      } catch {
        // 沒登入或 refresh 過期 → 維持登出狀態
      } finally {
        if (alive) setHydrated(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Ctx.Provider value={{ accessToken, user, setSession, clear, hydrated }}>
      {children}
    </Ctx.Provider>
  );
}
