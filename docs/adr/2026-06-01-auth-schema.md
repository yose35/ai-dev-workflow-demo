# ADR-001: 認證與付款資料模型

- 日期：2026-06-01
- 狀態：Accepted
- 決策者：AI Agent + 待 BE Lead 確認

## Context

Spec `login-and-payment.md` 要求支援：Email + 密碼、Google OAuth、TOTP 2FA、Stripe 卡片綁定。
需決定如何在資料層表達「同一使用者可有多種登入方式」與「卡片與 Stripe 關聯」。

## Options

### Option A：單一 users 表，OAuth 欄位平鋪
所有認證屬性（password_hash、oauth_provider、oauth_sub、totp_secret）放同表，可為 null。

- 優：查詢簡單、JOIN 少、適合 demo 規模
- 缺：未來支援多 OAuth provider 需新表

### Option B：identities 表獨立
users 只放 profile，identities 表記每個登入方式。

- 優：擴充性好
- 缺：複雜，本 spec 只一個 OAuth provider，過度設計

### Option C：events sourcing
記錄所有 auth event。

- 優：稽核完美
- 缺：本 demo 不需此複雜度

## Decision

**選 Option A。**

理由：
1. Spec 明確只做 Google OAuth，YAGNI
2. demo 規模 < 10k 使用者，效能無虞
3. 未來真要支援多 provider，可加 identities 表並 backfill

## Consequences

- 正面：schema 簡單、3 張表覆蓋所有 spec 需求
- 負面：未來新增 Apple Login 等需要 migration
- 待辦：在 `users.oauth_provider, oauth_sub` 建 composite index 加速 Google 登入查詢

## References

- Spec: `specs/login-and-payment.md` § 6
- Prisma: `packages/db/prisma/schema.prisma`
- Migration: `packages/db/prisma/migrations/20260601_init/migration.sql`
