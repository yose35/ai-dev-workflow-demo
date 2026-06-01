// CLAUDE.md 鐵則 #5 + Spec 第 10 節：argon2id, memoryCost 64MB / timeCost 3 / parallelism 4
// 採用 @node-rs/argon2（Rust 實作，預編譯 binary，避免 node-gyp build 問題）
import { hash as a2hash, verify as a2verify, Algorithm } from '@node-rs/argon2';

const argonOpts = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 1 << 16, // 64 MB
  timeCost: 3,
  parallelism: 4,
};

export async function hashPassword(plain: string): Promise<string> {
  return a2hash(plain, argonOpts);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await a2verify(hash, plain);
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
