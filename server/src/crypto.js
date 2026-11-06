import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export const zufall = (n = 32) => randomBytes(n).toString('base64url');
export const hash = s => createHash('sha256').update(s).digest('hex');
export const gleich = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
export const hmac = (key, s) => createHmac('sha256', key).update(s).digest('hex');
