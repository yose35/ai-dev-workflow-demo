import { describe, it, expect, vi, afterEach } from 'vitest';
import { issueState, verifyState } from './csrfState.js';

const SECRET = 'x'.repeat(32);

describe('csrfState', () => {
  afterEach(() => vi.useRealTimers());

  it('剛簽出的 state 立即驗證為 valid', () => {
    const s = issueState(SECRET);
    expect(verifyState(s, SECRET)).toBe(true);
  });

  it('用錯的 secret 驗證 → false', () => {
    const s = issueState(SECRET);
    expect(verifyState(s, 'y'.repeat(32))).toBe(false);
  });

  it('過期的 state → false', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const s = issueState(SECRET);
    vi.setSystemTime(new Date('2026-01-01T00:10:00Z')); // 10 分鐘後 (TTL=5min)
    expect(verifyState(s, SECRET)).toBe(false);
  });

  it('被改過的簽章 → false', () => {
    const s = issueState(SECRET);
    const tampered = s.slice(0, -2) + 'ff';
    expect(verifyState(tampered, SECRET)).toBe(false);
  });

  it('格式錯誤 → false', () => {
    expect(verifyState('garbage', SECRET)).toBe(false);
    expect(verifyState('a.b', SECRET)).toBe(false);
    expect(verifyState('', SECRET)).toBe(false);
  });
});
