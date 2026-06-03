// CLAUDE.md 慣例：API 一律回 { ok: false, error: { code, message } }，code 用 SCREAMING_SNAKE
export type ErrorCode =
  | 'USER_EXISTS'
  | 'WEAK_PASSWORD'
  | 'INVALID_EMAIL'
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'TWO_FA_REQUIRED'
  | 'INVALID_2FA_CODE'
  | 'OAUTH_STATE_INVALID'
  | 'NOT_FOUND'
  | 'INVALID_DATE_RANGE'
  | 'RANGE_TOO_LARGE'
  | 'UNKNOWN_BRAND'
  | 'INTERNAL';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return { ok: false as const, error: { code: this.code, message: this.message } };
  }
}

export const errors = {
  userExists: () => new AppError('USER_EXISTS', 409, 'Email already registered'),
  weakPassword: (msg: string) => new AppError('WEAK_PASSWORD', 400, msg),
  invalidEmail: () => new AppError('INVALID_EMAIL', 400, 'Email format invalid'),
  invalidCredentials: () => new AppError('INVALID_CREDENTIALS', 401, ''),
  rateLimited: () => new AppError('RATE_LIMITED', 429, 'Too many attempts, retry later'),
  twoFaRequired: () => new AppError('TWO_FA_REQUIRED', 202, ''),
  invalid2faCode: () => new AppError('INVALID_2FA_CODE', 401, ''),
  oauthStateInvalid: (msg = 'Invalid OAuth state') => new AppError('OAUTH_STATE_INVALID', 401, msg),
  notFound: (what: string) => new AppError('NOT_FOUND', 404, `${what} not found`),
  invalidDateRange: (msg = 'from 必須早於或等於 to') =>
    new AppError('INVALID_DATE_RANGE', 400, msg),
  rangeTooLarge: (maxDays: number) =>
    new AppError('RANGE_TOO_LARGE', 400, `區間不可超過 ${maxDays} 天`),
  unknownBrand: (brand: string) => new AppError('UNKNOWN_BRAND', 400, `未知品牌：${brand}`),
};
