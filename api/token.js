// Guardar como: lib/token.js
// Credencial firmada (HMAC-SHA256) con vencimiento. Sin base de datos: solo tu servidor puede crearla.
import { createHmac, timingSafeEqual } from 'node:crypto';

const b64 = (s) => Buffer.from(s).toString('base64url');

function secret() {
  const s = process.env.TOKEN_SECRET;
  if (!s || s.length < 32) throw new Error('TOKEN_SECRET falta o tiene menos de 32 caracteres');
  return s;
}

export function tokenConfigured() {
  return !!process.env.TOKEN_SECRET && process.env.TOKEN_SECRET.length >= 32;
}

export function signToken(email, ttlMs = 24 * 3600 * 1000) {
  const payload = b64(JSON.stringify({ e: email, x: Date.now() + ttlMs }));
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return payload + '.' + sig;
}

export function verifyToken(token) {
  try {
    const [payload, sig] = String(token || '').split('.');
    if (!payload || !sig) return null;
    const good = createHmac('sha256', secret()).update(payload).digest('base64url');
    const a = Buffer.from(sig), b = Buffer.from(good);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.e || !(data.x > Date.now())) return null;
    return data; // { e: correo, x: vencimiento }
  } catch {
    return null;
  }
}
