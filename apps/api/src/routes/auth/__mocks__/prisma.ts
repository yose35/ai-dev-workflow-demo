// 共用 prisma mock — 供 auth / payments 測試使用
// in-memory store，每個 test 開始時 clear
import { vi } from 'vitest';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  totpSecret: string | null;
  stripeCustomerId: string | null;
  oauthProvider: string | null;
  oauthSub: string | null;
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
export interface PaymentMethodRecord {
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  createdAt: Date;
}

export const stores = {
  users: new Map<string, UserRecord>(),
  refreshTokens: [] as RefreshTokenRecord[],
  paymentMethods: [] as PaymentMethodRecord[],
};

let idCounter = 0;
const nextId = () => `id_${++idCounter}`;

function matchUser(u: UserRecord, where: any): boolean {
  if (where.id && u.id !== where.id) return false;
  if (where.email && u.email !== where.email) return false;
  if (where.stripeCustomerId && u.stripeCustomerId !== where.stripeCustomerId) return false;
  if (where.oauthProvider !== undefined && u.oauthProvider !== where.oauthProvider) return false;
  if (where.oauthSub !== undefined && u.oauthSub !== where.oauthSub) return false;
  return true;
}

export const prismaMock = {
  user: {
    findUnique: vi.fn(({ where }: any) => {
      if (where.email) return Promise.resolve(stores.users.get(where.email) ?? null);
      if (where.id) {
        for (const u of stores.users.values()) if (u.id === where.id) return Promise.resolve(u);
      }
      if (where.stripeCustomerId) {
        for (const u of stores.users.values()) {
          if (u.stripeCustomerId === where.stripeCustomerId) return Promise.resolve(u);
        }
      }
      return Promise.resolve(null);
    }),
    findFirst: vi.fn(({ where }: any) => {
      for (const u of stores.users.values()) {
        if (matchUser(u, where)) return Promise.resolve(u);
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
        oauthProvider: data.oauthProvider ?? null,
        oauthSub: data.oauthSub ?? null,
        createdAt: new Date(),
      };
      stores.users.set(rec.email, rec);
      return Promise.resolve(select ? { id: rec.id, email: rec.email, createdAt: rec.createdAt } : rec);
    }),
    update: vi.fn(({ where, data }: any) => {
      for (const u of stores.users.values()) {
        if (u.id === where.id) {
          Object.assign(u, data);
          return Promise.resolve(u);
        }
      }
      return Promise.reject(new Error('not found'));
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
        const matchUserT = where.userId ? r.userId === where.userId : true;
        const matchHash = where.tokenHash ? r.tokenHash === where.tokenHash : true;
        const matchRevoked = where.revokedAt === null ? r.revokedAt === null : true;
        if (matchUserT && matchHash && matchRevoked) {
          Object.assign(r, data);
          n++;
        }
      }
      return Promise.resolve({ count: n });
    }),
  },
  paymentMethod: {
    findMany: vi.fn(({ where }: any) => {
      return Promise.resolve(
        stores.paymentMethods
          .filter((p) => !where?.userId || p.userId === where.userId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      );
    }),
    findUnique: vi.fn(({ where }: any) => {
      const rec = stores.paymentMethods.find(
        (p) =>
          (where.id && p.id === where.id) ||
          (where.stripePaymentMethodId && p.stripePaymentMethodId === where.stripePaymentMethodId)
      );
      return Promise.resolve(rec ?? null);
    }),
    create: vi.fn(({ data }: any) => {
      const rec: PaymentMethodRecord = {
        id: nextId(),
        userId: data.userId,
        stripePaymentMethodId: data.stripePaymentMethodId,
        brand: data.brand ?? null,
        last4: data.last4 ?? null,
        expMonth: data.expMonth ?? null,
        expYear: data.expYear ?? null,
        isDefault: data.isDefault ?? false,
        createdAt: new Date(),
      };
      stores.paymentMethods.push(rec);
      return Promise.resolve(rec);
    }),
    delete: vi.fn(({ where }: any) => {
      const i = stores.paymentMethods.findIndex((p) => p.id === where.id);
      if (i >= 0) {
        const removed = stores.paymentMethods.splice(i, 1)[0];
        return Promise.resolve(removed);
      }
      return Promise.reject(new Error('not found'));
    }),
    deleteMany: vi.fn(({ where }: any) => {
      const before = stores.paymentMethods.length;
      stores.paymentMethods = stores.paymentMethods.filter(
        (p) => p.stripePaymentMethodId !== where.stripePaymentMethodId
      );
      return Promise.resolve({ count: before - stores.paymentMethods.length });
    }),
  },
};

export function resetStores() {
  stores.users.clear();
  stores.refreshTokens.length = 0;
  stores.paymentMethods.length = 0;
  idCounter = 0;
  vi.clearAllMocks();
}
