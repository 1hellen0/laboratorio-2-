import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,password} from './fixture.js';

test('RF-01/02 · registro, Argon2id, regeneración, vencimiento y cierre por HTTP', async t=>{
  const {request,db,login,register,clock}=await fixture(t);
  const correo='prueba@example.test';
  assert.equal((await request('/')).status,200);
  await register(correo);
  const u=await db.collection('usuarios').findOne({correo});
  assert.equal(u.rol,'usuario');
  assert.match(u.hashContrasena,/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(await db.collection('sesiones').countDocuments(),0);
  const first=await login(correo);
  const next=await login(correo,password,first);
  assert.notEqual(first,next);
  assert.equal((await request('/cuenta',{cookie:first})).status,401);
  assert.equal((await request('/cuenta',{cookie:next})).status,200);
  assert.equal((await request('/api/salida',{body:{},cookie:next})).status,204);
  assert.equal(await db.collection('sesiones').countDocuments(),0);
  assert.equal((await request('/cuenta',{cookie:next})).status,401);
  const last=await login(correo);
  clock.value+=8*3600000+1;
  assert.equal((await request('/cuenta',{cookie:last})).status,401);
});
test('validación del alta, CSRF y origen',async t=>{
  const {request}=await fixture(t);
  const body={correo:'abc@example.test',nombre:'Eva',contrasena:password};
  for(const patch of [{rol:'administrador'},{contrasena:'corta'},{nombre:''},{correo:'mal'}])
    assert.equal((await request('/api/registro',{body:{...body,...patch}})).status,400);
  for(const headers of [{Origin:'https://otro.example'},{'X-SecureVault':''}])
    assert.equal((await request('/api/registro',{body,headers})).status,403);
});
