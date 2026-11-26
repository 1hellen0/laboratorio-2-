import { createApp } from './app.js';
import { configFrom } from './config.js';
import { connectMongo, verifyDatabase } from './db.js';
import { delivery } from './mail.js';

const config = configFrom(process.env);
const databaseName = process.env.DB_NAME || 'securevault_local';
const client = connectMongo(process.env.MONGODB_URI, config.prod);

try {
  await client.connect();
  const db = client.db(databaseName);
  await verifyDatabase(db);
  const app = await createApp({ db, config, deliver: delivery(config, process.env) });
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(JSON.stringify({ tipo: 'inicio', resultado: 'listo', puerto: config.port, entorno: config.prod ? 'production' : 'development' }));
  });
  const stop = signal => {
    console.log(JSON.stringify({ tipo: 'cierre', resultado: 'iniciado', senal: signal }));
    server.close(async () => {
      await client.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));
} catch (error) {
  console.error(JSON.stringify({ tipo: 'inicio', resultado: 'error', clase: error.name }));
  await client.close();
  process.exitCode = 1;
}
