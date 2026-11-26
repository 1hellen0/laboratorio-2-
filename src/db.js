import { MongoClient } from 'mongodb';

export function connectMongo(uri, prod = false) {
  if (!uri) throw Error('Falta la URI de MongoDB');
  if (prod && /[?&](?:tlsInsecure|tlsAllowInvalidCertificates|tlsAllowInvalidHostnames)=true|[?&](?:tls|ssl)=false/i.test(uri))
    throw Error('La conexión de producción requiere verificación TLS');
  return new MongoClient(uri, { ...(prod ? { tls: true } : {}), serverSelectionTimeoutMS: 3500, connectTimeoutMS: 3500, socketTimeoutMS: 5000, waitQueueTimeoutMS: 3500, maxPoolSize: 12 });
}
const str = { bsonType: 'string' }, oid = { bsonType: 'objectId' }, date = { bsonType: 'date' }, int = { bsonType: 'int' };
function schema(properties, required = Object.keys(properties)) {
  return { bsonType: 'object', required, properties, additionalProperties: false };
}
const envelope = schema({ versionLlave: int, iv: str, tag: str, datos: str });
const definitions = {
  usuarios: schema({ _id: oid, correo: str, nombre: str, hashContrasena: str, rol: {enum:['usuario','administrador']},
    versionAcceso: int, telefonoCifrado: envelope, recuperacion: schema({hashToken:str,expiraEn:date}) },
    ['_id','correo','nombre','hashContrasena','rol','versionAcceso']),
  sesiones: schema({ _id: str, usuarioId: oid, versionAcceso: int, creadaEn: date, expiraEn: date }),
  notas: schema({ _id: oid, propietarioId: oid, posicion: {bsonType:'int',minimum:1,maximum:50},
    contenidoCifrado: envelope, creadaEn: date, actualizadaEn: date }),
  eventosSeguridad: schema({ _id: oid, tipo: str, resultado: str, ocurridoEn: date, solicitudId: str, actorId: oid, objetivoId: oid },
    ['_id','tipo','resultado','ocurridoEn','solicitudId']),
  limitesAcceso: schema({ _id: str, intentos: int, inicioVentana: date, expiraEn: date, bloqueadoHasta: date },
    ['_id','intentos','inicioVentana','expiraEn'])
};
export async function prepareDatabase(db) {
  for (const [name, definition] of Object.entries(definitions)) {
    const validator = { $jsonSchema: definition };
    try { await db.createCollection(name, {validator}); }
    catch (err) {
      if (err.code !== 48) throw err;
      await db.command({collMod: name, validator});
    }
  }
  await db.collection('usuarios').createIndex({correo:1},{unique:true});
  await db.collection('usuarios').createIndex({'recuperacion.hashToken':1},{unique:true, partialFilterExpression:{'recuperacion.hashToken':{$type:'string'}}});
  await db.collection('sesiones').createIndex({usuarioId:1});
  for (const name of ['sesiones','limitesAcceso']) await db.collection(name).createIndex({expiraEn:1},{expireAfterSeconds:0});
  await db.collection('notas').createIndex({propietarioId:1,posicion:1},{unique:true});
  await db.collection('notas').createIndex({propietarioId:1,actualizadaEn:-1});
  await db.collection('eventosSeguridad').createIndex({ocurridoEn:-1,_id:-1});
  await db.collection('eventosSeguridad').createIndex({ocurridoEn:1},{expireAfterSeconds:2592000});
}
