"use client";
// Google 登入按鈕
// - 設定了 NEXT_PUBLIC_GOOGLE_CLIENT_ID + 載入 Google Identity Services → 真實 Google One Tap
// - 否則（demo / msw 模式）→ 顯示 demo 按鈕，用 fake id_token + 真 state 走完 OAuth flow
import { useState } from "react";
import { apiFetch, type ApiError } from "@/lib/api-client";
import type { AuthSuccess } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-store";
import { useRouter } from "next/navigation";

const GOOGLE_CID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function GoogleSignInButton() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const signIn = async () => {
    setBusy(true);
    setErr(null);
    try {
      // 1. 先跟 BE 要一個 CSRF state token
      const stateRes = await apiFetch<{ data: { state: string } }>("/auth/google/state");

      // 2. 取得 Google id_token
      let id_token: string;
      if (GOOGLE_CID && typeof window !== "undefined" && "google" in window) {
        // 真實環境：呼叫 Google Identity Services 拿 credential
        id_token = await promptGoogle(GOOGLE_CID);
      } else {
        // demo / msw 模式：用 fake id_token（msw 不會真驗章）
        id_token = "demo.fake.id-token-" + Date.now();
      }

      // 3. 送到 BE 驗證並換 session
      const res = await apiFetch<AuthSuccess>("/auth/google", {
        method: "POST",
        body: JSON.stringify({ id_token, state: stateRes.data.state }),
      });
      setSession(res.data.access_token, res.data.user);
      router.push("/");
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="w-full h-11 px-4 inline-flex items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <GoogleG />
        {busy ? "處理中..." : "以 Google 登入"}
      </button>
      {!GOOGLE_CID && (
        <p className="mt-1.5 text-[10px] text-slate-400 text-center">
          🧪 Demo 模式（未設 GOOGLE_CLIENT_ID）— msw 接受任意 id_token
        </p>
      )}
      {err && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}

// 真實 Google Identity Services 整合（需先 load https://accounts.google.com/gsi/client）
function promptGoogle(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // @ts-expect-error - google 由 GIS script 注入
    const g = window.google?.accounts?.id;
    if (!g) {
      reject(new Error("Google Identity Services 未載入"));
      return;
    }
    g.initialize({
      client_id: clientId,
      callback: (r: { credential?: string }) => {
        if (r.credential) resolve(r.credential);
        else reject(new Error("Google 未回傳 credential"));
      },
    });
    g.prompt();
  });
}

function GoogleG() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.85.87-3.04.87-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.73A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.73V4.94H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.06l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.94l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
