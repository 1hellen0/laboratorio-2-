import { configFrom } from '../src/config.js';
import { connectMongo, prepareDatabase } from '../src/db.js';

const config = configFrom(process.env);
const client = connectMongo(process.env.MONGODB_URI, config.prod);
try {
  await client.connect();
  await prepareDatabase(client.db(process.env.DB_NAME || 'securevault_local'));
  console.log('Colecciones, validadores e índices preparados.');
} catch {
  console.error('No se pudo preparar la base de datos. Revisá MONGODB_URI y el estado de MongoDB.');
  process.exitCode = 1;
} finally {
  await client.close();
}
