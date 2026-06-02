// 2FA challenge token — login → 提示 2FA 時發給 client，verify 時帶回
// 結構同 csrfState：HMAC 簽 nonce.userId.exp，5 分鐘 TTL
// 不存 DB，無狀態
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const CHALLENGE_TTL_SEC = 300;
const DOMAIN = '2fa';

export function issueChallenge(userId: string, secret: string): string {
  const nonce = randomBytes(8).toString('hex');
  const exp = Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SEC;
  const payload = `${DOMAIN}.${nonce}.${userId}.${exp}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export interface VerifiedChallenge {
  ok: true;
  userId: string;
}
export interface InvalidChallenge {
  ok: false;
}
export type ChallengeResult = VerifiedChallenge | InvalidChallenge;

export function verifyChallenge(token: string, secret: string): ChallengeResult {
  const parts = token.split('.');
  if (parts.length !== 5) return { ok: false };
  const [domain, nonce, userId, expStr, sig] = parts;
  if (domain !== DOMAIN || !nonce || !userId || !expStr || !sig) return { ok: false };

  const exp = Number.parseInt(expStr, 10);
  if (Number.isNaN(exp) || exp < Math.floor(Date.now() / 1000)) return { ok: false };

  const expected = createHmac('sha256', secret)
    .update(`${domain}.${nonce}.${userId}.${expStr}`)
    .digest('hex');
  if (expected.length !== sig.length) return { ok: false };

  try {
    const eq = timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
    return eq ? { ok: true, userId } : { ok: false };
  } catch {
    return { ok: false };
  }
}
