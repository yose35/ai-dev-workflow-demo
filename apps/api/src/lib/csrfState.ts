// OAuth state token — HMAC 簽章的短效期 token，防 CSRF
// 設計：nonce.exp.signature，全程 constant-time 比較
// Spec: AC-L3, 第 8 節 OAuth state mismatch → 401 OAUTH_STATE_INVALID
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const STATE_TTL_SEC = 300; // 5 分鐘

export function issueState(secret: string): string {
  const nonce = randomBytes(16).toString('hex');
  const exp = Math.floor(Date.now() / 1000) + STATE_TTL_SEC;
  const payload = `${nonce}.${exp}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyState(token: string, secret: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [nonce, expStr, sig] = parts;
  if (!nonce || !expStr || !sig) return false;

  const exp = Number.parseInt(expStr, 10);
  if (Number.isNaN(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const expected = createHmac('sha256', secret).update(`${nonce}.${expStr}`).digest('hex');
  if (expected.length !== sig.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
}
