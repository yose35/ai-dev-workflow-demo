// 型別安全的 fetch wrapper
// 預設 base URL 為相對路徑 → 在 dev / test 由 msw 攔截；切換到真實 BE 只改 NEXT_PUBLIC_API_BASE
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export interface ApiError extends Error {
  code?: string;
  status?: number;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
    credentials: "include",
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: ApiError = new Error(body?.error?.message || res.statusText);
    err.code = body?.error?.code;
    err.status = res.status;
    throw err;
  }
  return body as T;
}
