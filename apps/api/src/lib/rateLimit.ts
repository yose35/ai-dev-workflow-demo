// 簡單的 in-memory rate limiter for login attempts (AC-L2)
// 真實環境換成 Redis-backed；此處足以 demo 邏輯正確性
// key = `${ip}:${email}` 兩者任一達上限即鎖

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function checkLoginAttempt(key: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  b.count += 1;
  if (b.count > MAX_ATTEMPTS) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true };
}

export function resetLoginAttempts(key: string): void {
  buckets.delete(key);
}

// for tests
export function _clearAll(): void {
  buckets.clear();
}
