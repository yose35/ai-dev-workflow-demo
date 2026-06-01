// CLAUDE.md 鐵則 #5 + Spec 第 10 節：argon2id, memoryCost 64MB / timeCost 3 / parallelism 4
import * as argon2 from 'argon2';

const argonOpts: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 1 << 16, // 64 MB
  timeCost: 3,
  parallelism: 4,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, argonOpts);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

// AC-R3 驗證：至少 10 字、含字母與數字
export function validatePassword(password: string): { ok: true } | { ok: false; reason: string } {
  if (password.length < 10) {
    return { ok: false, reason: '密碼長度至少 10 字' };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, reason: '密碼需含字母與數字' };
  }
  return { ok: true };
}
