import { describe, it, expect, vi, afterEach } from 'vitest';
import { issueChallenge, verifyChallenge } from './twoFaChallenge.js';

const SECRET = 'x'.repeat(32);

describe('twoFaChallenge', () => {
  afterEach(() => vi.useRealTimers());

  it('剛簽出立即驗證 → ok + userId', () => {
    const t = issueChallenge('user_abc', SECRET);
    const r = verifyChallenge(t, SECRET);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.userId).toBe('user_abc');
  });

  it('錯誤 secret → ok=false', () => {
    const t = issueChallenge('user_abc', SECRET);
    expect(verifyChallenge(t, 'y'.repeat(32)).ok).toBe(false);
  });

  it('過期 → ok=false', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const t = issueChallenge('user_abc', SECRET);
    vi.setSystemTime(new Date('2026-01-01T00:10:00Z'));
    expect(verifyChallenge(t, SECRET).ok).toBe(false);
  });

  it('被改過的簽章 → ok=false', () => {
    const t = issueChallenge('user_abc', SECRET);
    const tampered = t.slice(0, -2) + 'ff';
    expect(verifyChallenge(tampered, SECRET).ok).toBe(false);
  });

  it('domain 不對（別人的 token 拿來用）→ ok=false', () => {
    // 模擬 csrfState token 拿來當 2fa challenge
    expect(verifyChallenge('foo.bar.baz.123.deadbeef', SECRET).ok).toBe(false);
  });
});
