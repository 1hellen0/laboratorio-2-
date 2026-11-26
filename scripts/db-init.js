import { connectMongo, prepareDatabase } from '../src/db.js';

const prod = process.env.NODE_ENV === 'production';
const uri = process.env.MONGODB_ADMIN_URI || process.env.MONGODB_URI;
if (prod && (!process.env.MONGODB_ADMIN_URI || !process.env.DB_NAME)) {
  console.error('En produccion, db:init requiere MONGODB_ADMIN_URI y DB_NAME.');
  process.exitCode = 1;
} else {
  const client = connectMongo(uri, prod);
  try {
    await client.connect();
    await prepareDatabase(client.db(process.env.DB_NAME || 'securevault_local'));
    console.log('Colecciones, validadores e indices preparados.');
  } catch {
    console.error('No se pudo preparar la base de datos. Revisa la URI de mantenimiento y el estado de MongoDB.');
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}
