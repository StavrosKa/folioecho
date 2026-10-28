import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
export function sign(value: string) {
  const secret = process.env.FOLIOECHO_SESSION_SECRET ?? '';
  if (secret.length < 32) throw new Error('Configure the private demo session secret (at least 32 characters).');
  return createHmac('sha256', secret).update(value).digest('base64url');
}
export function validSignature(value: string, signature: string) {
  const expected = Buffer.from(sign(value)); const supplied = Buffer.from(signature);
  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}
export function visitor(cookie?: string) {
  const parts = (cookie ?? '').split('.');
  if (parts.length === 3 && /^[a-f0-9-]{36}$/.test(parts[0]) && Number(parts[1]) > Date.now() && validSignature(`${parts[0]}.${parts[1]}`,parts[2])) return { id: parts[0], cookie: cookie!, fresh: false };
  const id = randomUUID(); const value = `${id}.${Date.now() + 7 * 86400_000}`;
  return { id, cookie: `${value}.${sign(value)}`, fresh: true };
}
