// FE 首頁 — 健康檢查與環境訊息
"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useApiReady } from "@/components/MswProvider";

interface Status {
  ok: boolean;
  data?: { status: string; mock?: boolean };
}

export default function Home() {
  const api = useApiReady();
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!api.ready) return; // 等 msw / 真實 BE 就緒才 call API
    setStatus(null);
    setErr(null);
    apiFetch<Status>("/health")
      .then(setStatus)
      .catch((e) => setErr(e.message));
  }, [api.ready]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="max-w-2xl w-full">
        <p className="text-sm font-bold tracking-widest text-accent uppercase mb-3">
          AI Dev Workflow · FE
        </p>
        <h1 className="text-5xl font-extrabold text-primary-900 tracking-tight mb-4">
          FE 已就緒 ✓
        </h1>
        <p className="text-lg text-slate-700 mb-10 leading-relaxed">
          BE 不在也能跑。msw 攔截 fetch、OpenAPI 產出型別、Next.js 15 App Router 就緒。
          這個頁面證明「FE 平行開發」不是 PPT 上的口號 — 是已經跑起來的事實。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <Card title="Next.js 15" body="App Router + TypeScript strict + Tailwind" />
          <Card title="OpenAPI Types" body="由 packages/contract/openapi.yaml 自動產 TS" />
          <Card title="MSW Mock" body="覆蓋全部 12 端點，dev / test 共用" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">
            健康檢查（GET /health · 資料來源：{labelFor(api.source)}）
          </p>
          {!api.ready && <p className="text-slate-400 text-sm">⏳ 等待 API 就緒...</p>}
          {api.ready && err && <pre className="text-red-600 text-sm">{err}</pre>}
          {api.ready && !status && !err && <p className="text-slate-400 text-sm">⏳ 載入中...</p>}
          {status && (
            <pre className="bg-slate-50 rounded p-3 text-sm font-mono text-slate-800 overflow-x-auto">
              {JSON.stringify(status, null, 2)}
            </pre>
          )}
        </div>

        <p className="mt-8 text-xs text-slate-500 italic">
          下一步：FE PR #2 — 註冊 / 登入 / 2FA 三個頁面
        </p>
      </div>
    </main>
  );
}

function labelFor(s: "real-backend" | "msw" | "loading"): string {
  return { "real-backend": "真實 BE", msw: "MSW mock", loading: "載入中" }[s];
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="font-bold text-primary-900 mb-1">{title}</p>
      <p className="text-sm text-slate-600">{body}</p>
    </div>
  );
}
