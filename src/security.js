import { argon2, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(argon2);
const params = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };
const prefix = '$argon2id$v=19$m=19456,t=2,p=1$';
const b64 = bytes => bytes.toString('base64').replace(/=+$/, '');

export function fail(status, message) { throw Object.assign(new Error(message), { publicStatus: status }); }
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const mac = (key, data) => createHmac('sha256', key).update(data).digest('base64url');
export const fresh = () => randomBytes(32).toString('base64url');
export function hashId(token) { return sha(Buffer.from(token, 'base64url')); }

export async function hashPassword(password) {
  const nonce = randomBytes(16);
  const result = await derive('argon2id', { ...params, message: password, nonce });
  return prefix + b64(nonce) + '$' + b64(result);
}
export async function verifyPassword(password, hash) {
  if (!hash.startsWith(prefix)) return false;
  const [salt, value] = hash.slice(prefix.length).split('$');
  const expected = Buffer.from(value, 'base64');
  const nonce = Buffer.from(salt, 'base64');
  if (nonce.length !== 16 || expected.length !== 32) return false;
  const actual = await derive('argon2id', { ...params, message: password, nonce });
  return timingSafeEqual(expected, actual);
}
export function fields(body, allowed) {
  if (!body || Array.isArray(body) || typeof body !== 'object' ||
      Object.keys(body).length !== allowed.length ||
      !allowed.every(k => Object.hasOwn(body, k) && typeof body[k] === 'string'))
    fail(400, 'Campos inválidos.');
  return body;
}
export function email(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) fail(400, 'Correo inválido.');
  return normalized;
}
export function policy(value) {
  const groups = [/\p{Lu}/u, /\p{Ll}/u, /\p{Nd}/u, /[^\p{L}\p{N}\s]/u];
  const length = [...value].length;
  if (length < 12 || length > 128 || groups.filter(group => group.test(value)).length < 3)
    fail(400, 'Usá entre 12 y 128 caracteres y tres grupos entre mayúsculas, minúsculas, números y símbolos.');
}
