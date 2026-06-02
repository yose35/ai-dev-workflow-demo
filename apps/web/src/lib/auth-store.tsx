// 簡單的 auth state — access token 存在記憶體 (Context)，refresh 走 httpOnly cookie
// 重新整理會掉 access token，需呼叫 /auth/refresh 拿新的（之後 PR 補上）
"use client";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { User } from "./api-types";

export interface AuthState {
  accessToken: string | null;
  user: User | null;
  setSession: (token: string, u: User) => void;
  clear: () => void;
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
  const setSession = useCallback((token: string, u: User) => {
    setAccessToken(token);
    setUser(u);
  }, []);
  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);
  return (
    <Ctx.Provider value={{ accessToken, user, setSession, clear }}>
      {children}
    </Ctx.Provider>
  );
}
