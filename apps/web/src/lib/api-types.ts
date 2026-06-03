// API 型別 — 對應 packages/contract/openapi.yaml
// 此檔由 `pnpm contract:gen` 自動產出（用 openapi-typescript CLI）
// 暫時手寫，等 install 完跑 codegen 會被取代為自動產出版
// 真正的自動產出檔放在 api-types.gen.ts（gitignore 也可選擇 commit）

export type Iso8601 = string;
export type UUID = string;

export interface AuthSuccess {
  ok: true;
  data: {
    access_token: string;
    expires_in: number;
    user: User;
  };
}

export interface User {
  id: UUID;
  email: string;
  two_fa_enabled: boolean;
  has_payment_method: boolean;
  created_at: Iso8601;
}

export interface PaymentMethod {
  id: UUID;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

export interface ApiErrorBody {
  ok: false;
  error: {
    code:
      | "USER_EXISTS"
      | "WEAK_PASSWORD"
      | "INVALID_EMAIL"
      | "INVALID_CREDENTIALS"
      | "RATE_LIMITED"
      | "TWO_FA_REQUIRED"
      | "INVALID_2FA_CODE"
      | "OAUTH_STATE_INVALID"
      | "NOT_FOUND"
      | "INTERNAL";
    message: string;
    challenge_id?: string;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
}
export interface LoginRequest {
  email: string;
  password: string;
}
export interface GoogleRequest {
  id_token: string;
  state: string;
}
export interface Verify2faRequest {
  code: string;
  challenge_id?: string;
}
export interface Enroll2faResponse {
  ok: true;
  data: { secret: string; qr_data: string };
}
export interface SetupIntentResponse {
  ok: true;
  data: { client_secret: string };
}
export interface ListMethodsResponse {
  ok: true;
  data: PaymentMethod[];
}

// ── Dashboard KPI（specs/dashboard-kpi.md §7）─────────────
export type MetricKey =
  | "wager"
  | "validWager"
  | "ggr"
  | "margin"
  | "playerCount"
  | "betCount"
  | "atppu";

export interface DateRange {
  from: string;
  to: string;
}

export interface KpiCell {
  value: number;
  compare: number;
  changePct: number | null;
  spark: number[];
}

export interface KpiResponse {
  ok: true;
  data: {
    source: string;
    granularity: "day" | "week" | "month";
    period: DateRange;
    compare: DateRange;
    kpis: Record<MetricKey, KpiCell>;
  };
}

export interface TimeseriesPoint {
  bucket: string;
  [metric: string]: string | number;
}

export interface TimeseriesResponse {
  ok: true;
  data: {
    source: string;
    granularity: "day" | "week" | "month";
    period: DateRange;
    metrics: MetricKey[];
    points: TimeseriesPoint[];
  };
}
