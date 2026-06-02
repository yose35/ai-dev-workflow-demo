// Webhook event idempotency — 防同一 event 被處理兩次
// 簡化版：in-memory Set + LRU。Production 應改為 Redis / DB 持久化。
// AC-PAY-2 + spec § 8: 以 event.id 作 idempotency key

const MAX_ENTRIES = 10_000;
const seen = new Set<string>();
const order: string[] = [];

export function alreadyProcessed(eventId: string): boolean {
  return seen.has(eventId);
}

export function markProcessed(eventId: string): void {
  if (seen.has(eventId)) return;
  seen.add(eventId);
  order.push(eventId);
  if (order.length > MAX_ENTRIES) {
    const drop = order.shift();
    if (drop) seen.delete(drop);
  }
}

// for tests
export function _resetIdempotency(): void {
  seen.clear();
  order.length = 0;
}
