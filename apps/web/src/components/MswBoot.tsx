"use client";
// dev mode 自動啟動 msw service worker
// production build 完全不引入 msw（透過 dynamic import + NODE_ENV 條件）
import { useEffect } from "react";

export function MswBoot() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (process.env.NEXT_PUBLIC_API_BASE) return; // 若指定真實 BE，跳過 mock
    void import("@/mocks/browser").then(({ startMsw }) => startMsw());
  }, []);
  return null;
}
