// 共用 prisma mock — 供 login / refresh / logout 測試使用
// in-memory store，每個 test 開始時 clear
import { vi } from 'vitest';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  totpSecret: string | null;
  stripeCustomerId: string | null;
  createdAt: Date;
}
export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export const stores = {
  users: new Map<string, UserRecord>(),       // key = email
  refreshTokens: [] as RefreshTokenRecord[],
};

let idCounter = 0;
const nextId = () => `id_${++idCounter}`;

export const prismaMock = {
  user: {
    findUnique: vi.fn(({ where }: any) => {
      if (where.email) return Promise.resolve(stores.users.get(where.email) ?? null);
      if (where.id) {
        for (const u of stores.users.values()) {
          if (u.id === where.id) return Promise.resolve(u);
        }
      }
      return Promise.resolve(null);
    }),
    create: vi.fn(({ data, select }: any) => {
      const rec: UserRecord = {
        id: nextId(),
        email: data.email,
        passwordHash: data.passwordHash ?? null,
        totpSecret: null,
        stripeCustomerId: null,
        createdAt: new Date(),
      };
      stores.users.set(rec.email, rec);
      return Promise.resolve(select ? { id: rec.id, email: rec.email, createdAt: rec.createdAt } : rec);
    }),
  },
  refreshToken: {
    create: vi.fn(({ data }: any) => {
      const rec: RefreshTokenRecord = {
        id: nextId(),
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        revokedAt: null,
        createdAt: new Date(),
      };
      stores.refreshTokens.push(rec);
      return Promise.resolve(rec);
    }),
    findFirst: vi.fn(({ where }: any) => {
      const rec = stores.refreshTokens.find((r) => r.tokenHash === where.tokenHash);
      return Promise.resolve(rec ?? null);
    }),
    update: vi.fn(({ where, data }: any) => {
      const rec = stores.refreshTokens.find((r) => r.id === where.id);
      if (rec) Object.assign(rec, data);
      return Promise.resolve(rec);
    }),
    updateMany: vi.fn(({ where, data }: any) => {
      let n = 0;
      for (const r of stores.refreshTokens) {
        const matchUser = where.userId ? r.userId === where.userId : true;
        const matchHash = where.tokenHash ? r.tokenHash === where.tokenHash : true;
        const matchRevoked = where.revokedAt === null ? r.revokedAt === null : true;
        if (matchUser && matchHash && matchRevoked) {
          Object.assign(r, data);
          n++;
        }
      }
      return Promise.resolve({ count: n });
    }),
  },
};

export function resetStores() {
  stores.users.clear();
  stores.refreshTokens.length = 0;
  idCounter = 0;
  vi.clearAllMocks();
}
