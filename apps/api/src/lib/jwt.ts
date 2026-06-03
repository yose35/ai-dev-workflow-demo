// CLAUDE.md：JWT 短效期 + refresh
import { SignJWT, jwtVerify } from 'jose';

export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
}

export async function signAccessToken(
  payload: AccessTokenPayload,
  secret: string,
  ttlSec: number
): Promise<{ token: string; expiresIn: number }> {
  const key = new TextEncoder().encode(secret);
  const token = await new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSec}s`)
    .sign(key);
  return { token, expiresIn: ttlSec };
}

export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<AccessTokenPayload> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
    throw new Error('Malformed JWT payload');
  }
  return { sub: payload.sub, email: payload.email };
}
