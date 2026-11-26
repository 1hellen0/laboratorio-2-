import {connectMongo} from '../src/db.js';
import {promote} from '../src/admin.js';
const client=connectMongo(process.env.MONGODB_ADMIN_URI,process.env.NODE_ENV==='production');
try {
  if(!process.argv[2] || !process.env.DB_NAME) throw Error('Indicá el correo de una cuenta registrada y DB_NAME');
  const changed=await promote(client,client.db(process.env.DB_NAME),process.argv[2]);
  console.log(changed?'Rol actualizado. Volvé a ingresar.':'La cuenta ya tiene el rol administrador.');
} catch {console.error('No se pudo promover la cuenta. Verificá correo, permisos y conexión a un replica set.');process.exitCode=1;}
finally {await client.close();}
