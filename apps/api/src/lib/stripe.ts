// Stripe client 單例 — 從 env 注入 secret
// 抽離以便 test 用 vi.mock 整包替換
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(secretKey: string): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
      typescript: true,
    });
  }
  return _stripe;
}

// 給 test 用：重置 singleton
export function _resetStripe() {
  _stripe = null;
}

export type { Stripe };
