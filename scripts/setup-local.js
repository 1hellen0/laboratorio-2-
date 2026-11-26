import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { MongoMemoryServer } from 'mongodb-memory-server-core';

const path = '.env';
let existing = '';
try { existing = await readFile(path, 'utf8'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

const values = new Map();
for (const line of existing.split(/\r?\n/)) {
  const match = /^(DATA_ENCRYPTION_KEY|DATA_KEY_VERSION|SESSION_SECRET|RATE_LIMIT_SECRET|MONGODB_URI|DB_NAME|APP_ORIGIN)=([^\s#]*)\s*$/.exec(line);
  if (match) values.set(match[1], match[2]);
}
const bytes = () => randomBytes(32).toString('base64');
values.set('DATA_ENCRYPTION_KEY', values.get('DATA_ENCRYPTION_KEY') || bytes());
values.set('DATA_KEY_VERSION', values.get('DATA_KEY_VERSION') || '1');
values.set('SESSION_SECRET', values.get('SESSION_SECRET') || bytes());
values.set('RATE_LIMIT_SECRET', values.get('RATE_LIMIT_SECRET') || bytes());
values.set('DB_NAME', values.get('DB_NAME') || 'securevault_local');
values.set('APP_ORIGIN', values.get('APP_ORIGIN') || 'http://127.0.0.1:3000');

await mkdir('.local', { recursive: true });
const mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1', port: 27018 } });
values.set('MONGODB_URI', values.get('MONGODB_URI') || mongo.getUri());
const content = [...values].map(([key, value]) => key + '=' + value).join('\n') + '\n';
await writeFile(path, content, { mode: 0o600 });

if (mongo.getUri() !== values.get('MONGODB_URI')) {
  await mongo.stop();
  throw Error('MongoDB local ya está en uso; detené el proceso existente antes de preparar el entorno.');
}
await writeFile('.local/mongodb.pid', String(mongo.instanceInfo.instance.mongodProcess.pid), { mode: 0o600 });
console.log('Configuración local preparada. Las llaves existentes se conservaron.');
console.log('MongoDB local: ' + values.get('MONGODB_URI'));
