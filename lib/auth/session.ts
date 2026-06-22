// Сессия на подписанном cookie (HMAC-SHA256 через Web Crypto — доступно и в
// middleware (Edge), и в Node-роутах). Без внешних зависимостей.

export type UserRole = 'applicant' | 'expert' | 'admin';

export interface SessionUser {
  sub: string;
  role: UserRole;
  name: string;
}

export const SESSION_COOKIE = 'ndda_session';
export const SESSION_MAX_AGE = Number(process.env.AUTH_SESSION_MAX_AGE || 60 * 60 * 12); // 12 часов

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function utf8(value: string): BufferSource {
  return new TextEncoder().encode(value) as unknown as BufferSource;
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET || '';
  if (!secret) throw new Error('AUTH_SECRET is not configured');
  return crypto.subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signSession(user: SessionUser): Promise<string> {
  const payload = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
  const data = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await getKey();
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, utf8(data)));
  return `${data}.${toBase64Url(signature)}`;
}

export async function verifySession(token: string | undefined | null): Promise<(SessionUser & { exp: number }) | null> {
  if (!token || !token.includes('.')) return null;
  const [data, signature] = token.split('.');
  try {
    const key = await getKey();
    const valid = await crypto.subtle.verify('HMAC', key, fromBase64Url(signature) as unknown as BufferSource, utf8(data));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(data)));
    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.sub || !payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}
