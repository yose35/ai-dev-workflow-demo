-- 對應 ADR: docs/adr/2026-06-01-auth-schema.md
-- 涵蓋 Spec login-and-payment.md AC-R1..R4 / AC-L1..L4 / AC-PAY-1..5

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "users" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"               TEXT NOT NULL UNIQUE,
  "password_hash"       TEXT,
  "totp_secret"         TEXT,
  "stripe_customer_id"  TEXT UNIQUE,
  "oauth_provider"      TEXT,
  "oauth_sub"           TEXT,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_users_oauth" ON "users" ("oauth_provider", "oauth_sub");

CREATE TABLE "refresh_tokens" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash"  TEXT NOT NULL,
  "expires_at"  TIMESTAMPTZ NOT NULL,
  "revoked_at"  TIMESTAMPTZ,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_refresh_user" ON "refresh_tokens" ("user_id");

CREATE TABLE "payment_methods" (
  "id"                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"                   UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "stripe_payment_method_id"  TEXT NOT NULL UNIQUE,
  "brand"                     TEXT,
  "last4"                     TEXT,
  "exp_month"                 INTEGER,
  "exp_year"                  INTEGER,
  "is_default"                BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at"                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_pm_user" ON "payment_methods" ("user_id");
