// 型別安全的 fetch wrapper
// 預設 base URL 為相對路徑 → 在 dev / test 由 msw 攔截；切換到真實 BE 只改 NEXT_PUBLIC_API_BASE
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export interface ApiError extends Error {
  code?: string;
  status?: number;
  challenge_id?: string;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
    credentials: "include",
    ...init,
  });

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: unknown;
    error?: { code?: string; message?: string; challenge_id?: string };
  };

  // 視 body.ok === false 為錯誤（含 BE 的 202 + TWO_FA_REQUIRED 情境）
  if (!res.ok || body.ok === false) {
    const err: ApiError = new Error(body.error?.message || res.statusText);
    err.code = body.error?.code;
    err.status = res.status;
    err.challenge_id = body.error?.challenge_id;
    throw err;
  }
  return body as T;
}
