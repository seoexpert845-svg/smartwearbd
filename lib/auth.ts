import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'smartwearbd_session';
export type SessionRole = 'user' | 'admin';
export type SessionPayload = { sub: string; role: SessionRole; exp: number };

type AuthGlobal = typeof globalThis & { __smartwearSessionSecret?: string };

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be configured in production.');
  }
  const runtime = globalThis as AuthGlobal;
  runtime.__smartwearSessionSecret ??= randomBytes(32).toString('base64url');
  return runtime.__smartwearSessionSecret;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSession(payload: Omit<SessionPayload, 'exp'>, lifetimeSeconds: number) {
  const secret = sessionSecret();
  const session = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + lifetimeSeconds })).toString('base64url');
  const signature = createHmac('sha256', secret).update(session).digest('base64url');
  return `${session}.${signature}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  const secret = sessionSecret();
  if (!secret || !token) return null;
  const [session, signature, extra] = token.split('.');
  if (!session || !signature || extra) return null;
  const expected = createHmac('sha256', secret).update(session).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(session, 'base64url').toString()) as SessionPayload;
    if (!payload.sub || !['user', 'admin'].includes(payload.role) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function secureStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
