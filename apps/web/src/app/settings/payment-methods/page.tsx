"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiFetch, type ApiError } from "@/lib/api-client";
import { useApiReady } from "@/components/MswProvider";
import type { PaymentMethod, ListMethodsResponse } from "@/lib/api-types";

// AC-PAY-3, AC-PAY-4, AC-PAY-5
export default function PaymentMethodsPage() {
  const api = useApiReady();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiFetch<ListMethodsResponse>("/payments/methods");
      setMethods(res.data);
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (api.ready) void load();
  }, [api.ready]);

  const confirmDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      await apiFetch(`/payments/methods/${id}`, { method: "DELETE" });
      setMethods((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setErr((e as ApiError).message);
    }
  };

  const onlyOne = methods.length === 1;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm font-bold tracking-widest text-accent uppercase">SETTINGS</p>
          <h1 className="text-3xl font-extrabold text-primary-900">付款方式</h1>
          <p className="mt-2 text-sm text-slate-600">管理已綁定的信用卡。卡號全程由 Stripe 保管。</p>
        </div>
        <Button onClick={() => alert("Demo：實際會開啟 Stripe Elements 收卡片")}>
          + 新增卡片
        </Button>
      </header>

      {err && (
        <p className="text-sm text-red-600" role="alert">
          {err}
        </p>
      )}

      {loading && <p className="text-slate-400">⏳ 載入中...</p>}

      {!loading && methods.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-600">目前尚未綁定任何卡片</p>
          <p className="mt-1 text-xs text-slate-400">點擊上方「+ 新增卡片」開始</p>
        </div>
      )}

      <ul className="space-y-3">
        {methods.map((m) => (
          <li
            key={m.id}
            className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <BrandBadge brand={m.brand} />
              <div>
                <p className="font-semibold text-primary-900">
                  •••• {m.last4}
                  {m.is_default && (
                    <span className="ml-2 text-xs font-medium text-accent">DEFAULT</span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  到期 {String(m.exp_month).padStart(2, "0")} / {m.exp_year}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingDelete(m.id)}
              aria-label={`刪除卡片 ${m.last4}`}
            >
              刪除
            </Button>
          </li>
        ))}
      </ul>

      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h2 id="confirm-title" className="text-lg font-bold text-primary-900">
              確認刪除這張卡片？
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {onlyOne
                ? "這是你目前唯一的付款方式，刪除後將無法自動扣款。確認嗎？"
                : "此操作會解除與 Stripe 的綁定。"}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPendingDelete(null)}>
                取消
              </Button>
              <Button size="sm" onClick={() => confirmDelete(pendingDelete)}>
                確認刪除
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BrandBadge({ brand }: { brand: string }) {
  const map: Record<string, string> = {
    visa: "bg-blue-100 text-blue-700",
    mastercard: "bg-red-100 text-red-700",
    amex: "bg-emerald-100 text-emerald-700",
  };
  const cls = map[brand?.toLowerCase()] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold uppercase ${cls}`}>
      {brand}
    </span>
  );
}
