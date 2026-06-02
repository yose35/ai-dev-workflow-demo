// TOTP 封裝（spec § 10：constant-time 比較）
// otplib.authenticator.verify 內部使用 timing-safe 比較
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

const ISSUER = 'AI Dev Workflow Demo';

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildOtpAuthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export async function generateQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: 'M', margin: 1 });
}

export function verifyTotp(code: string, secret: string): boolean {
  if (!/^[0-9]{6}$/.test(code)) return false;
  // otplib 預設允許 ±1 step (30 秒) 容錯，符合常規做法
  return authenticator.verify({ token: code, secret });
}
