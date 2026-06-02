// MSW handlers — 覆蓋 packages/contract/openapi.yaml 全部 12 端點
// 行為盡量貼近 BE 真實邏輯（含錯誤 code），讓 FE 在不接 BE 也能跑完整 happy path
import { http, HttpResponse } from "msw";
import type {
  AuthSuccess,
  User,
  PaymentMethod,
  ApiErrorBody,
} from "@/lib/api-types";

// ── persistent store（localStorage 在瀏覽器、in-memory 在 node test）─────
// 跨 page reload 維持狀態：避免「註冊完跳登入就帳密錯誤」這類雜訊
type UserRec = User & { password: string; totpSecret?: string };
const USERS_KEY = "msw_users_v1";
const METHODS_KEY = "msw_methods_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function loadMap<V>(key: string): Map<string, V> {
  if (!isBrowser()) return new Map();
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Map(JSON.parse(raw)) : new Map();
  } catch {
    return new Map();
  }
}

function saveMap<V>(key: string, map: Map<string, V>): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, JSON.stringify([...map.entries()]));
  } catch {
    // localStorage 滿了 / 隱私模式 → 忽略
  }
}

const users: Map<string, UserRec> = loadMap<UserRec>(USERS_KEY);
const methods: Map<string, PaymentMethod> = loadMap<PaymentMethod>(METHODS_KEY);

const persistUsers = () => saveMap(USERS_KEY, users);
const persistMethods = () => saveMap(METHODS_KEY, methods);

// 給 demo 用：清掉所有 mock 狀態（暴露在 window，devtools 可呼叫）
if (isBrowser()) {
  (window as unknown as { __mswReset?: () => void }).__mswReset = () => {
    users.clear();
    methods.clear();
    localStorage.removeItem(USERS_KEY);
    localStorage.removeItem(METHODS_KEY);
    console.log("[msw] state cleared. reload page to re-seed.");
  };
}

const ok = <T,>(data: T) => HttpResponse.json({ ok: true, data });
const fail = (code: ApiErrorBody["error"]["code"], status: number, message = ""): Response =>
  HttpResponse.json({ ok: false, error: { code, message } } satisfies ApiErrorBody, { status });

// 用 btoa（瀏覽器 & Node 都有），不用 Buffer（Node-only）
const fakeJwt = (sub: string) => {
  const b64 = btoa(JSON.stringify({ sub, mock: true }));
  // base64 → base64url
  const b64url = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return "eyJ" + b64url + ".mock.sig";
};

const minUser = (u: User & { password: string }): User => ({
  id: u.id,
  email: u.email,
  two_fa_enabled: u.two_fa_enabled,
  has_payment_method: u.has_payment_method,
  created_at: u.created_at,
});

// ── handlers ──────────────────────────────────────────────────
export const handlers = [
  http.get("/health", () => ok({ status: "healthy", mock: true })),

  // Register
  http.post("/auth/register", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(body.email)) return fail("INVALID_EMAIL", 400);
    if (body.password.length < 10 || !/[A-Za-z]/.test(body.password) || !/[0-9]/.test(body.password))
      return fail("WEAK_PASSWORD", 400, "密碼長度至少 10 字且含字母數字");
    if (users.has(body.email)) return fail("USER_EXISTS", 409);
    const u = {
      id: crypto.randomUUID(),
      email: body.email,
      two_fa_enabled: false,
      has_payment_method: false,
      created_at: new Date().toISOString(),
      password: body.password,
    };
    users.set(body.email, u);
    persistUsers();
    return HttpResponse.json<AuthSuccess>(
      { ok: true, data: { access_token: fakeJwt(u.id), expires_in: 900, user: minUser(u) } },
      { status: 201 }
    );
  }),

  // Login
  http.post("/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    const u = users.get(body.email);
    if (!u || u.password !== body.password) return fail("INVALID_CREDENTIALS", 401);
    if (u.totpSecret) {
      const challenge_id = "mock-challenge-" + u.id;
      return HttpResponse.json(
        { ok: false, error: { code: "TWO_FA_REQUIRED", message: "", challenge_id } },
        { status: 202 }
      );
    }
    return HttpResponse.json<AuthSuccess>(
      { ok: true, data: { access_token: fakeJwt(u.id), expires_in: 900, user: minUser(u) } },
      { headers: { "set-cookie": "refresh_token=mock; HttpOnly; SameSite=Strict; Path=/auth" } }
    );
  }),

  // Google OAuth
  http.get("/auth/google/state", () => ok({ state: "mock.state.token" })),
  http.post("/auth/google", async ({ request }) => {
    const body = (await request.json()) as { id_token: string; state: string };
    if (body.state !== "mock.state.token") return fail("OAUTH_STATE_INVALID", 401);
    const email = "google-user@example.com";
    let u = users.get(email);
    if (!u) {
      u = {
        id: crypto.randomUUID(),
        email,
        two_fa_enabled: false,
        has_payment_method: false,
        created_at: new Date().toISOString(),
        password: "",
      };
      users.set(email, u);
      persistUsers();
    }
    return HttpResponse.json<AuthSuccess>({
      ok: true,
      data: { access_token: fakeJwt(u.id), expires_in: 900, user: minUser(u) },
    });
  }),

  // Refresh / Logout
  http.post("/auth/refresh", () => ok({ access_token: fakeJwt("mock-user"), expires_in: 900 })),
  http.post("/auth/logout", () => new HttpResponse(null, { status: 204 })),

  // 2FA
  http.post("/auth/2fa/enroll", () => {
    // 1x1 png 充當 QR data url
    const qr =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    return ok({ secret: "MOCKSECRETBASE32", qr_data: qr });
  }),
  http.post("/auth/2fa/verify", async ({ request }) => {
    const body = (await request.json()) as { code: string; challenge_id?: string };
    if (!/^[0-9]{6}$/.test(body.code)) return fail("INVALID_2FA_CODE", 401);
    if (body.code === "000000") return fail("INVALID_2FA_CODE", 401);
    return HttpResponse.json<AuthSuccess>({
      ok: true,
      data: {
        access_token: fakeJwt("mock-user"),
        expires_in: 900,
        user: {
          id: "mock-user",
          email: "alice@example.com",
          two_fa_enabled: true,
          has_payment_method: false,
          created_at: new Date().toISOString(),
        },
      },
    });
  }),

  // Me
  http.get("/me", () =>
    ok({
      id: "mock-user",
      email: "alice@example.com",
      two_fa_enabled: false,
      has_payment_method: methods.size > 0,
      created_at: new Date().toISOString(),
    } satisfies User)
  ),

  // Payments
  http.post("/payments/setup-intent", () => ok({ client_secret: "seti_mock_secret_xxx" })),
  // Demo only：在真實環境這個由 Stripe 自己送 webhook 觸發。
  // 為了讓 FE 在 msw mock 下也能跑通完整綁卡流程，提供一個 mock-only 的「seed 卡片」入口。
  http.post("/payments/_demo/seed-card", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      brand?: string;
      last4?: string;
      exp_month?: number;
      exp_year?: number;
    };
    const card = {
      id: crypto.randomUUID(),
      brand: body.brand ?? "visa",
      last4: body.last4 ?? "4242",
      exp_month: body.exp_month ?? 12,
      exp_year: body.exp_year ?? 2029,
      is_default: methods.size === 0,
    };
    methods.set(card.id, card);
    persistMethods();
    return ok(card);
  }),
  http.post("/payments/webhooks/stripe", () => ok({ received: true })),
  http.get("/payments/methods", () => ok(Array.from(methods.values()))),
  http.delete("/payments/methods/:id", ({ params }) => {
    const id = params.id as string;
    if (!methods.has(id)) return fail("NOT_FOUND", 404);
    methods.delete(id);
    persistMethods();
    return new HttpResponse(null, { status: 204 });
  }),
];

// 給 test / dev demo 用：seed 一張示範卡片（僅在 store 還是空的時候 seed）
export function seedDemoData() {
  if (methods.size > 0) return; // 已有資料就不再 seed
  const pmId = crypto.randomUUID();
  methods.set(pmId, {
    id: pmId,
    brand: "visa",
    last4: "4242",
    exp_month: 12,
    exp_year: 2029,
    is_default: true,
  });
  persistMethods();
}
