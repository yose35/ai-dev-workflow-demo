// 型別安全的 fetch wrapper + 自動 401 → refresh → retry（single-flight）
// 預設 base URL 為相對路徑 → dev / test 由 msw 攔截；切換到真實 BE 只改 NEXT_PUBLIC_API_BASE
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export interface ApiError extends Error {
  code?: string;
  status?: number;
  challenge_id?: string;
}

// ── In-memory access token store（避免 localStorage 被 XSS 偷）─────
let _accessToken: string | null = null;
export const tokenStore = {
  get: () => _accessToken,
  set: (t: string | null) => {
    _accessToken = t;
  },
};

// Single-flight refresh — 並發請求只觸發一次 /auth/refresh
let _refreshPromise: Promise<string | null> | null = null;
async function refreshOnce(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { data: { access_token: string } };
      tokenStore.set(body.data.access_token);
      return body.data.access_token;
    } catch {
      return null;
    } finally {
      // 下個 tick 清掉，後續新的 401 才能再觸發
      setTimeout(() => {
        _refreshPromise = null;
      }, 0);
    }
  })();
  return _refreshPromise;
}

interface ApiFetchOpts extends RequestInit {
  /** 內部用：避免無限遞迴 */
  _retried?: boolean;
  /** 跳過自動帶 Authorization（如 /auth/refresh 自己）*/
  _skipAuth?: boolean;
}

export async function apiFetch<T>(path: string, init: ApiFetchOpts = {}): Promise<T> {
  const { _retried, _skipAuth, ...rest } = init;
  const headers = new Headers({
    "content-type": "application/json",
    ...(rest.headers as Record<string, string> | undefined),
  });
  if (!_skipAuth && _accessToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${_accessToken}`);
  }

  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers,
    credentials: "include",
  });

  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: unknown;
    error?: { code?: string; message?: string; challenge_id?: string };
  };

  // 401 + 還沒重試過 + 不是 /auth/refresh 自己 → 嘗試 refresh
  if (res.status === 401 && !_retried && !_skipAuth && path !== "/auth/refresh") {
    const newToken = await refreshOnce();
    if (newToken) {
      return apiFetch<T>(path, { ...init, _retried: true });
    }
  }

  if (!res.ok || body.ok === false) {
    const err: ApiError = new Error(body.error?.message || res.statusText);
    err.code = body.error?.code;
    err.status = res.status;
    err.challenge_id = body.error?.challenge_id;
    throw err;
  }
  return body as T;
}
