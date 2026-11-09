// ============================================================
// Sign-in: one password (Worker secret CRM_PASSWORD) and an HMAC-signed,
// HttpOnly session cookie. Checked in the (app) layout for pages and again in
// every server action, so no write runs without a valid session.
// ============================================================
import { cookies } from 'next/headers';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { DataApi } from './data-api';

export const SESSION_COOKIE = 'waraqa_crm_session';
const SESSION_DAYS = 7;

function env() {
  return getCloudflareContext().env;
}

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(data: string): Promise<string> {
  const secret = env().SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be set (32+ characters).');
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

/** Compare digests so the time taken doesn't depend on how much of a guess was right. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

export async function checkPassword(given: string): Promise<boolean> {
  const expected = env().CRM_PASSWORD;
  if (!expected || expected.length < 8) throw new Error('CRM_PASSWORD must be set (8+ characters).');
  return safeEqual(given, expected);
}

/** false when this IP has used up its sign-in attempts. */
export async function loginAllowed(ip: string): Promise<boolean> {
  const limiter = env().LOGIN_LIMITER;
  if (!limiter) return true;
  const { success } = await limiter.limit({ key: `login:${ip}` });
  return success;
}

export async function startSession() {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = b64url(enc.encode(JSON.stringify({ exp })));
  const value = `${payload}.${await hmac(payload)}`;
  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function hasSession(): Promise<boolean> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return false;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return false;
  if (!(await safeEqual(sig, await hmac(payload)))) return false;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(json) as { exp: number };
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}

/** For server actions: throws when there is no valid session. */
export async function requireSession() {
  if (!(await hasSession())) throw new Error('Signed out. Reload the page and sign in again.');
}

/**
 * The data Worker, with every result turned into plain JSON. Values that come
 * back over a Workers RPC binding aren't plain objects, and React refuses to
 * hand anything else to a client component or return it from a server action.
 */
export function data(): DataApi {
  const target = env().DATA;
  return new Proxy(target, {
    get(t, prop) {
      const fn = (t as unknown as Record<string | symbol, unknown>)[prop];
      if (typeof fn !== 'function') return fn;
      return async (...args: unknown[]) => JSON.parse(JSON.stringify(await (fn as (...a: unknown[]) => unknown).apply(t, args)));
    },
  });
}
