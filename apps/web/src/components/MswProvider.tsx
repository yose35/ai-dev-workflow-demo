"use client";
// Provider 形式：dev 模式啟動 msw，等 service worker ready 後才釋放 children 的 API call
// 解決 first-paint race：msw 還沒攔到時 fetch 直接打到 Next 而 404
import { createContext, useContext, useEffect, useState } from "react";

interface ApiReadiness {
  ready: boolean;
  source: "real-backend" | "msw" | "loading";
}
const Ctx = createContext<ApiReadiness>({ ready: false, source: "loading" });

export function useApiReady(): ApiReadiness {
  return useContext(Ctx);
}

export function MswProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ApiReadiness>({ ready: false, source: "loading" });

  useEffect(() => {
    // production build 或設定了真實 BE → 直接 ready，不引入 msw
    if (process.env.NODE_ENV !== "development" || process.env.NEXT_PUBLIC_API_BASE) {
      setState({ ready: true, source: "real-backend" });
      return;
    }
    void import("@/mocks/browser").then(async ({ startMsw }) => {
      await startMsw();
      setState({ ready: true, source: "msw" });
    });
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
