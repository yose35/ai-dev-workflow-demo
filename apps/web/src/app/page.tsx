// FE 首頁 — 健康檢查 + 快速導航
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useApiReady } from "@/components/MswProvider";
import { useAuth } from "@/lib/auth-store";

interface Status {
  ok: boolean;
  data?: { status: string; mock?: boolean };
}

export default function Home() {
  const api = useApiReady();
  const { user } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!api.ready) return;
    setStatus(null);
    setErr(null);
    apiFetch<Status>("/health")
      .then(setStatus)
      .catch((e) => setErr(e.message));
  }, [api.ready]);

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
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

      {/* ── 快速導航 ─────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xs font-bold tracking-widest text-slate-500 uppercase mb-3">
          {user ? `歡迎回來，${user.email}` : "開始使用"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {user ? (
            <>
              <ActionCard
                href="/settings/2fa/enroll"
                title="兩階段驗證"
                body="啟用 TOTP，下次登入需 6 位數驗證碼"
                icon="🔐"
              />
              <ActionCard
                href="/settings/payment-methods"
                title="付款方式"
                body="管理綁定的信用卡（Stripe 保管卡號）"
                icon="💳"
              />
            </>
          ) : (
            <>
              <ActionCard
                href="/login"
                title="登入"
                body="Email / 密碼 或 Google 一鍵登入"
                icon="→"
              />
              <ActionCard
                href="/register"
                title="建立帳號"
                body="30 秒註冊，含密碼強度即時提示"
                icon="✦"
              />
            </>
          )}
        </div>
      </section>

      {/* ── 技術棧卡片（demo 用）─────────────────────────── */}
      <h2 className="text-xs font-bold tracking-widest text-slate-500 uppercase mb-3">
        技術棧（demo show-off）
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Card title="Next.js 15" body="App Router + TypeScript strict + Tailwind" />
        <Card title="OpenAPI Types" body="由 packages/contract/openapi.yaml 自動產 TS" />
        <Card title="MSW Mock" body="覆蓋全部 12 端點，dev / test 共用" />
      </div>

      {/* ── 健康檢查 ──────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">
          健康檢查（GET /health · 資料來源：{labelFor(api.source)}）
        </p>
        {!api.ready && <p className="text-slate-400 text-sm">⏳ 等待 API 就緒...</p>}
        {api.ready && err && <pre className="text-red-600 text-sm">{err}</pre>}
        {api.ready && !status && !err && (
          <p className="text-slate-400 text-sm">⏳ 載入中...</p>
        )}
        {status && (
          <pre className="bg-slate-50 rounded p-3 text-sm font-mono text-slate-800 overflow-x-auto">
            {JSON.stringify(status, null, 2)}
          </pre>
        )}
      </div>
    </main>
  );
}

function ActionCard({
  href,
  title,
  body,
  icon,
}: {
  href: string;
  title: string;
  body: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-200 bg-white p-5 hover:border-primary-500 hover:shadow-sm transition-all flex items-start gap-3"
    >
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <p className="font-bold text-primary-900 group-hover:text-accent">{title}</p>
        <p className="text-sm text-slate-600 mt-0.5">{body}</p>
      </div>
      <span className="text-slate-400 group-hover:text-accent">→</span>
    </Link>
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
