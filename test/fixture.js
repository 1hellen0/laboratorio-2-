import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {MongoMemoryServer,MongoMemoryReplSet} from 'mongodb-memory-server-core';
import {createApp} from '../src/app.js';
import {connectMongo, prepareDatabase} from '../src/db.js';
import {configFrom} from '../src/config.js';

export const password='Ejemplo-Local-2397';
export async function fixture(t,{replica=false}={}) {
  const mongo=replica ? await MongoMemoryReplSet.create({replSet:{count:1,ip:'127.0.0.1'}})
    : await MongoMemoryServer.create({instance:{ip:'127.0.0.1'}});
  const client=connectMongo(mongo.getUri());
  const db=client.db('securevault_test_'+randomBytes(5).toString('hex'));
  let server;
  t.after(async()=>{
    if(server) {server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));}
    await client.close(); await mongo.stop();
  });
  await prepareDatabase(db);
  const key=()=>randomBytes(32).toString('base64');
  const config=configFrom({DATA_ENCRYPTION_KEY:key(),SESSION_SECRET:key(),RATE_LIMIT_SECRET:key()});
  const clock={value:Date.now()}, logs=[], inbox=[];
  const app=await createApp({db,config,now:()=>new Date(clock.value),writeLog:line=>logs.push(line),
    deliver:async message=>{inbox.push(message)}});
  server=app.listen(0,'127.0.0.1');
  await once(server,'listening');
  const origin='http://127.0.0.1:'+server.address().port;
  config.origin=origin;
  async function request(path,{body,cookie,headers={}}={}) {
    const post=body!==undefined;
    return fetch(origin+path,{method:post?'POST':'GET',redirect:'manual',
      headers:{...(post?{'Content-Type':'application/json','X-SecureVault':'1',Origin:origin}:{}),
        ...(cookie?{Cookie:cookie}:{}),...headers},body:post?JSON.stringify(body):undefined});
  }
  async function register(correo) {
    assert.equal((await request('/api/registro',{body:{correo,nombre:'Persona de prueba',contrasena:password}})).status,201);
  }
  async function login(correo,contrasena=password,oldCookie) {
    const response=await request('/api/ingreso',{body:{correo,contrasena},cookie:oldCookie});
    assert.equal(response.status,200);
    return response.headers.get('set-cookie').split(';')[0];
  }
  return {db,config,clock,request,register,login,logs,inbox,origin,app,client};
}
