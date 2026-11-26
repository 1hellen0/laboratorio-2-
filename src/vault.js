import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';
import {ObjectId} from 'mongodb';
import {fail, fields} from './security.js';
import {requireUser} from './auth.js';

export function encrypt(config, text, context) {
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',config.keys.get(config.version),iv,{authTagLength:16});
  cipher.setAAD(Buffer.from(context));
  const data=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);
  return {versionLlave:config.version,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),datos:data.toString('base64')};
}
export function decrypt(config, envelope, context) {
  const key=config.keys.get(envelope.versionLlave);
  if(!key) throw Error('Versión de llave no disponible');
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'),{authTagLength:16});
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.datos,'base64')),decipher.final()]).toString('utf8');
}
function noteText(req) {
  const {contenido}=fields(req.body,['contenido']);
  const size=Buffer.byteLength(contenido,'utf8');
  if(!size) fail(400,'La nota está vacía.');
  if(size>8192) fail(413,'La nota supera 8192 bytes.');
  return contenido;
}
function owned(req) {
  if(!/^[a-f\d]{24}$/i.test(req.params.id)) fail(400,'Identificador inválido.');
  return {_id:new ObjectId(req.params.id),propietarioId:req.user._id};
}
const noteContext=id=>'notas.contenidoCifrado:'+id;
const phoneContext=id=>'usuarios.telefonoCifrado:'+id;

export function vaultRoutes({app,db,config,event,now}) {
  const notes=db.collection('notas'), users=db.collection('usuarios');
  async function missing(req) {
    await event(req,'accesoNota','denegado');
    fail(404,'Nota no encontrada.');
  }
  app.get('/notas',requireUser, async(req,res)=>{
    const list=await notes.find({propietarioId:req.user._id},{projection:{_id:1,actualizadaEn:1}}).sort({actualizadaEn:-1}).limit(50).toArray();
    res.render('notas',{notes:list});
  });
  app.get('/notas/:id',requireUser,async(req,res)=>{
    const note=await notes.findOne(owned(req));
    if(!note) await missing(req);
    const text=decrypt(config,note.contenidoCifrado,noteContext(note._id));
    res.render('nota',{noteId:note._id,text});
  });
  app.post('/api/notas',requireUser,async(req,res)=>{
    const contenido=noteText(req), propietarioId=req.user._id, _id=new ObjectId();
    const contenidoCifrado=encrypt(config,contenido,noteContext(_id));
    const ocupadas=new Set(await notes.distinct('posicion',{propietarioId}));
    const fecha=now();
    for(let posicion=1;posicion<=50;posicion++) {
      if(ocupadas.has(posicion)) continue;
      try {
        await notes.insertOne({_id,propietarioId,posicion,contenidoCifrado,creadaEn:fecha,actualizadaEn:fecha});
        return res.status(201).json({id:_id.toHexString()});
      } catch(err) {
        if(err.code!==11000 || !err.keyPattern?.posicion) throw err;
      }
    }
    fail(409,'Alcanzaste el máximo de 50 notas. Podés eliminar una para crear otra.');
  });
  app.post('/api/notas/:id/editar',requireUser,async(req,res)=>{
    const filter=owned(req);
    const contenidoCifrado=encrypt(config,noteText(req),noteContext(filter._id));
    const result=await notes.updateOne(filter,{$set:{contenidoCifrado,actualizadaEn:now()}});
    if(!result.matchedCount) await missing(req);
    res.json({mensaje:'Nota guardada.'});
  });
  app.post('/api/notas/:id/eliminar',requireUser,async(req,res)=>{
    fields(req.body,[]);
    if(!(await notes.deleteOne(owned(req))).deletedCount) await missing(req);
    res.status(204).end();
  });
  app.get('/perfil',requireUser,async(req,res)=>{
    const user=await users.findOne({_id:req.user._id},{projection:{telefonoCifrado:1}});
    const mask=user.telefonoCifrado ? '***-***-'+decrypt(config,user.telefonoCifrado,phoneContext(user._id)).slice(-4) : '';
    res.render('perfil',{mask});
  });
  app.post('/api/perfil',requireUser,async(req,res)=>{
    const {telefono}=fields(req.body,['telefono']);
    const normal=telefono.replace(/[ ()-]/g,'');
    if(!/^\+?[0-9]{7,15}$/.test(normal)) fail(400,'Teléfono inválido.');
    await users.updateOne({_id:req.user._id},{$set:{telefonoCifrado:encrypt(config,normal,phoneContext(req.user._id))}});
    res.json({mensaje:'Perfil guardado.'});
  });
}
