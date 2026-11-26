import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.js';

test('RF-04/05 · CRUD, propiedad de usuario y administrador, sobres y máscara',async t=>{
  const {register,login,request,db}=await fixture(t);
  const a='creadora@example.test', b='otra@example.test';
  await register(a); await register(b);
  const owner=await login(a), other=await login(b);
  const post=(path,cookie,body)=>request(path,{cookie,body});
  const original='Nota privada <ficticia>', telefono='+50688881234';
  const response=await post('/api/notas',owner,{contenido:original});
  assert.equal(response.status,201);
  const {id}=await response.json();
  assert.match(await (await request('/notas',{cookie:owner})).text(),new RegExp(id));
  assert.match(await (await request('/notas/'+id,{cookie:owner})).text(),/Nota privada &lt;ficticia&gt;/);
  for(const rol of ['usuario','administrador']){
    await db.collection('usuarios').updateOne({correo:b},{$set:{rol}});
    assert.equal((await request('/notas/'+id,{cookie:other})).status,404);
    assert.equal((await post('/api/notas/'+id+'/editar',other,{contenido:'Otra nota'})).status,404);
    assert.equal((await post('/api/notas/'+id+'/eliminar',other,{})).status,404);
    assert.ok(!(await (await request('/notas',{cookie:other})).text()).includes(id));
  }
  assert.equal((await post('/api/perfil',owner,{telefono})).status,200);
  const profile=await (await request('/perfil',{cookie:owner})).text();
  assert.ok(profile.includes('***-***-1234') && !profile.includes(telefono));
  const stored=await db.collection('notas').findOne({});
  const u=await db.collection('usuarios').findOne({correo:a});
  for(const envelope of [stored.contenidoCifrado,u.telefonoCifrado]){
    assert.equal(Buffer.from(envelope.iv,'base64').length,12);
    assert.equal(Buffer.from(envelope.tag,'base64').length,16);
    assert.equal(envelope.versionLlave,1);
  }
  assert.ok(!JSON.stringify(stored).includes(original) && !JSON.stringify(u).includes(telefono));
  assert.equal((await post('/api/notas/'+id+'/editar',owner,{contenido:'Edición ficticia'})).status,200);
  const edited=await db.collection('notas').findOne({});
  assert.notEqual(edited.contenidoCifrado.iv,stored.contenidoCifrado.iv);
  assert.ok((await (await request('/notas/'+id,{cookie:owner})).text()).includes('Edición ficticia'));
  assert.equal((await post('/api/notas/'+id+'/eliminar',owner,{})).status,204);
  assert.equal(await db.collection('notas').countDocuments(),0);
});
test('RF-04 · 8192/8193 bytes UTF-8 y dos altas en el cupo 50',async t=>{
  const {register,login,request,db}=await fixture(t);
  const correo='cuota@example.test'; await register(correo);const cookie=await login(correo);
  const add=contenido=>request('/api/notas',{body:{contenido},cookie});
  const value='á'.repeat(4096);
  const first=await add(value); assert.equal(first.status,201); const {id}=await first.json();
  assert.equal((await add(value+'a')).status,413);
  assert.equal((await request('/api/notas/'+id+'/editar',{cookie,body:{contenido:value+'a'}})).status,413);
  for(let i=1;i<49;i++) assert.equal((await add('Muestra '+i)).status,201);
  const statuses=(await Promise.all([add('Última A'),add('Última B')])).map(r=>r.status).sort();
  assert.deepEqual(statuses,[201,409]);assert.equal(await db.collection('notas').countDocuments(),50);
  assert.equal((await request('/api/notas/'+id+'/eliminar',{cookie,body:{}})).status,204);
  assert.equal((await add('Cupo libre')).status,201);
});
