import {email,fail,fields,fresh,hashId,hashPassword,policy} from './security.js';

export function recoveryRoutes({app,db,now,config,deliver,event,limits}) {
  const users=db.collection('usuarios');
  app.get('/recuperacion',(req,res)=>res.render('recuperacion'));
  app.get('/restablecer',(req,res)=>res.render('restablecer'));
  app.post('/api/recuperacion',async(req,res)=>{
    const correo=email(fields(req.body,['correo']).correo);
    await limits.recovery(req,res,correo);
    const token=fresh(), hashToken=hashId(token);
    const target=await users.findOneAndUpdate({correo},{$set:{recuperacion:{hashToken,expiraEn:new Date(+now()+900000)}}},
      {projection:{_id:1}});
    if(target){
      try {await deliver({correo,enlace:config.origin+'/restablecer#'+token});}
      catch {
        await users.updateOne({_id:target._id,'recuperacion.hashToken':hashToken},{$unset:{recuperacion:''}});
        await event(req,'entregaRecuperacion','fallido');
      }
    }
    res.status(202).json({mensaje:'Si existe la cuenta, recibirás un enlace.'});
  });
  app.post('/api/restablecer',async(req,res)=>{
    const {token,contrasena}=fields(req.body,['token','contrasena']);
    await limits.exchange(req,res);
    function invalid(){fail(400,'Enlace inválido o vencido.');}
    if(!/^[\w-]{43}$/.test(token) || Buffer.from(token,'base64url').toString('base64url')!==token) invalid();
    const hashToken=hashId(token);
    const filter=()=>({'recuperacion.hashToken':hashToken,'recuperacion.expiraEn':{$gt:now()}});
    const target=await users.findOne(filter(),{projection:{_id:1}});
    if(!target) invalid();
    policy(contrasena);
    const hashContrasena=await hashPassword(contrasena);
    const result=await users.updateOne({_id:target._id,...filter(),$expr:{$gt:['$recuperacion.expiraEn','$$NOW']}},
      {$set:{hashContrasena},$unset:{recuperacion:''},$inc:{versionAcceso:1}});
    if(!result.modifiedCount) invalid();
    await event(req,'recuperacion','correcto',target._id);
    res.json({mensaje:'Contraseña actualizada. Iniciá sesión.'});
  });
}
