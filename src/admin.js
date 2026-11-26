import {ObjectId} from 'mongodb';
import {email,fail} from './security.js';
import {requireUser} from './auth.js';
import {randomUUID} from 'node:crypto';

export async function promote(client,db,correo) {
  const normalized=email(correo);
  return client.withSession(session=>session.withTransaction(async()=>{
    const target=await db.collection('usuarios').findOne({correo:normalized},{session,projection:{rol:1}});
    if(!target) throw Error('Registrá primero la cuenta');
    if(target.rol==='administrador') return false;
    await db.collection('usuarios').updateOne({_id:target._id},{$set:{rol:'administrador'},$inc:{versionAcceso:1}},{session});
    await db.collection('eventosSeguridad').insertOne({tipo:'cambioRol',resultado:'correcto',objetivoId:target._id,
      solicitudId:randomUUID(),ocurridoEn:new Date()},{session});
    return true;
  }));
}
function cursor(value){
  if(value===undefined) return null;
  if(typeof value!=='string'||!/^[a-f0-9]{24}$/i.test(value)) fail(400,'Página inválida.');
  return new ObjectId(value);
}
export function adminRoutes({app,db,reader,event}) {
  app.get('/admin',requireUser,async(req,res)=>{
    if(req.user.rol!=='administrador'){
      await event(req,'panel','denegado');
      fail(403,'Acceso denegado.');
    }
    const uid=cursor(req.query.usuarios), eid=cursor(req.query.eventos);
    const users=await db.collection('usuarios').find(uid?{_id:{$lt:uid}}:{},
      {projection:{_id:1,nombre:1,correo:1,rol:1}}).sort({_id:-1}).limit(21).toArray();
    const log=reader.collection('eventosSeguridad');
    let filter={};
    if(eid){
      const anchor=await log.findOne({_id:eid},{projection:{ocurridoEn:1}});
      if(!anchor) fail(400,'Página vencida.');
      filter={$or:[{ocurridoEn:{$lt:anchor.ocurridoEn}},{ocurridoEn:anchor.ocurridoEn,_id:{$lt:eid}}]};
    }
    const events=await log.find(filter,{projection:{tipo:1,resultado:1,solicitudId:1,ocurridoEn:1,actorId:1,objetivoId:1}})
      .sort({ocurridoEn:-1,_id:-1}).limit(21).toArray();
    await event(req,'panel','correcto');
    res.render('admin',{users:users.slice(0,20),events:events.slice(0,20),moreUsers:users.length>20,moreEvents:events.length>20,
      uid:uid?.toHexString()||'',eid:eid?.toHexString()||''});
  });
}
