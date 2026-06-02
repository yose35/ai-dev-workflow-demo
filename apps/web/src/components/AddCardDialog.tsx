"use client";
// 加卡 dialog
// - 設定了 NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY → 真實 Stripe Elements
// - 否則 → demo 模式（直接呼叫 msw seed card endpoint）
// 真實環境流程：建 SetupIntent → Stripe Elements confirm → webhook 寫 DB
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiFetch, type ApiError } from "@/lib/api-client";

const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void; // 加完讓父元件 reload
}

export function AddCardDialog({ open, onClose, onAdded }: Props) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-card-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
    >
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <h2 id="add-card-title" className="text-xl font-bold text-primary-900">
          新增卡片
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          卡號全程由 Stripe 保管，伺服器永遠不會看到。
        </p>
        <div className="mt-5">
          {STRIPE_PK ? (
            <StripeMode onAdded={onAdded} onClose={onClose} />
          ) : (
            <DemoMode onAdded={onAdded} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Demo 模式：呼叫 msw seed endpoint 模擬「卡片綁定成功」─────────
function DemoMode({ onAdded, onClose }: { onAdded: () => void; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const addDemo = async (brand: string, last4: string) => {
    setBusy(true);
    setErr(null);
    try {
      // 真實流程：建 SetupIntent
      await apiFetch("/payments/setup-intent", { method: "POST" });
      // 真實流程接下來：Stripe Elements confirm → Stripe webhook → DB 寫入
      // demo 跳過中間步驟，直接 seed 一張卡（僅 msw 模式）
      await apiFetch("/payments/_demo/seed-card", {
        method: "POST",
        body: JSON.stringify({ brand, last4 }),
      });
      onAdded();
      onClose();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 mb-4">
        🧪 <strong>Demo 模式</strong> — 未設定 <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>，
        以 mock 卡片模擬綁定。真實環境會跳出 Stripe Elements 收卡片。
      </div>
      <div className="space-y-2">
        <button
          onClick={() => addDemo("visa", "4242")}
          disabled={busy}
          className="w-full text-left p-3 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          <div className="font-semibold">Visa •••• 4242</div>
          <div className="text-xs text-slate-500">Stripe 測試環境的 happy path 卡號</div>
        </button>
        <button
          onClick={() => addDemo("mastercard", "5555")}
          disabled={busy}
          className="w-full text-left p-3 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          <div className="font-semibold">Mastercard •••• 5555</div>
          <div className="text-xs text-slate-500">測試另一個 brand</div>
        </button>
      </div>
      {err && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {err}
        </p>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
          取消
        </Button>
      </div>
    </>
  );
}

// ── 真實 Stripe Elements 模式 ────────────────────────────────
function StripeMode({ onAdded, onClose }: { onAdded: () => void; onClose: () => void }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [Stripe, setStripe] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 動態載入避免 demo 模式時 bundle size 變大
        const { loadStripe } = await import("@stripe/stripe-js");
        const s = await loadStripe(STRIPE_PK!);
        if (!alive) return;
        setStripe(s);
        // 建 SetupIntent
        const res = await apiFetch<{ data: { client_secret: string } }>(
          "/payments/setup-intent",
          { method: "POST" }
        );
        if (!alive) return;
        setClientSecret(res.data.client_secret);
      } catch (e) {
        if (alive) setErr((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Note：完整 Stripe Elements 整合需要 @stripe/react-stripe-js 的 Elements + PaymentElement
  // 此處保留結構但需 install 後啟用。請見 docs/adr/2026-06-02-stripe-integration.md
  return (
    <div className="space-y-3">
      {!Stripe || !clientSecret ? (
        <p className="text-sm text-slate-500">⏳ 載入 Stripe Elements...</p>
      ) : (
        <div className="rounded-lg border border-slate-300 p-4 bg-slate-50 text-sm text-slate-700">
          <p className="font-semibold mb-1">Stripe Elements 占位</p>
          <p className="text-xs text-slate-500">
            install <code>@stripe/react-stripe-js</code> 後，這裡放 <code>&lt;Elements
            stripe={"{Stripe}"} options={"{ clientSecret }"}&gt; ... &lt;PaymentElement /&gt;
            ...</code>
          </p>
          <p className="text-xs text-slate-500 mt-2">client_secret: {clientSecret.slice(0, 24)}...</p>
        </div>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
          取消
        </Button>
        <Button
          size="sm"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            // 實際呼叫 stripe.confirmSetup(...) 流程，成功後：
            onAdded();
            onClose();
            setBusy(false);
          }}
        >
          確認綁定
        </Button>
      </div>
    </div>
  );
}
