import { Buffer } from 'node:buffer';

export function keyBytes(value, name) {
  const bytes = Buffer.from(value || '', 'base64');
  if (bytes.length !== 32 || bytes.toString('base64') !== value) throw Error('Se requieren 32 bytes Base64 en ' + name);
  return bytes;
}

export function configFrom(env) {
  const prod = env.NODE_ENV === 'production';
  const origin = new URL(env.APP_ORIGIN || 'http://127.0.0.1:3000');
  if (origin.origin !== (env.APP_ORIGIN || origin.origin) || (prod && origin.protocol !== 'https:'))
    throw Error('APP_ORIGIN debe ser un origen válido, HTTPS en producción');
  const version = Number(env.DATA_KEY_VERSION || 1);
  if (!Number.isSafeInteger(version) || version < 1) throw Error('DATA_KEY_VERSION inválida');
  const keys = new Map([[version, keyBytes(env.DATA_ENCRYPTION_KEY, 'DATA_ENCRYPTION_KEY')]]);
  for (const [name, value] of Object.entries(env)) {
    const match = /^DATA_PREVIOUS_KEY_([1-9]\d*)$/.exec(name);
    if (match) {
      if (Number(match[1]) === version) throw Error('Versión de llave duplicada');
      keys.set(Number(match[1]), keyBytes(value, name));
    }
  }
  const port = Number(env.PORT || origin.port || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('PORT inválido');
  const proxy = env.TRUST_PROXY_HOPS || '0';
  if (!['0','1'].includes(proxy)) throw Error('TRUST_PROXY_HOPS debe ser 0 o 1');
  return { prod, origin: origin.origin, port, proxy: Number(proxy), keys, version,
    sessionKey: keyBytes(env.SESSION_SECRET, 'SESSION_SECRET'), rateKey: keyBytes(env.RATE_LIMIT_SECRET, 'RATE_LIMIT_SECRET'),
    cookieName: prod ? '__Host-sid' : 'sv-sid' };
}
