import {fail,mac} from './security.js';

const minute=60000, windowMs=15*minute;
export function rateLimits({db,config,now,event}) {
  const store=db.collection('limitesAcceso');
  const key=(kind,value)=>kind+':'+mac(config.rateKey,kind+':'+value);
  function reject(res,until) {
    res.set('Retry-After',String(Math.max(1,Math.ceil((+until-+now())/1000))));
    fail(429,'Demasiados intentos. Probá más tarde.');
  }
  async function increment(kind,value,progressive=false) {
    const at=now();
    const expired={$lte:[{$ifNull:['$inicioVentana',new Date(0)]},new Date(+at-windowMs)]};
    const steps=[{$set:{
      inicioVentana:{$cond:[expired,at,'$inicioVentana']},
      intentos:{$cond:[expired,1,{$add:['$intentos',1]}]}
    }}];
    if(progressive) steps.push({$set:{bloqueadoHasta:{$cond:[
      {$gte:['$intentos',5]},{$add:[at,{$multiply:[minute,{$min:[15,{$pow:[2,{$min:[4,{$subtract:['$intentos',5]}]}]}]}]}]},'$$REMOVE'
    ]}}});
    steps.push({$set:{expiraEn:{$max:[{$add:['$inicioVentana',windowMs]},{$ifNull:['$bloqueadoHasta',at]}]}}});
    const filter={_id:key(kind,value)};
    try { return await store.findOneAndUpdate(filter,steps,{upsert:true,returnDocument:'after'}); }
    catch(err) {
      if(err.code!==11000) throw err;
      return store.findOneAndUpdate(filter,steps,{upsert:true,returnDocument:'after'});
    }
  }
  async function quota(req,res,kind,value,max) {
    const record=await increment(kind,value);
    if(record.intentos>max){
      if(record.intentos===max+1) await event(req,'limiteAcceso','bloqueado');
      reject(res,record.expiraEn);
    }
  }
  return {
    async beforeLogin(req,res,correo) {
      await quota(req,res,'ingreso-ip',req.ip,30);
      const record=await store.findOne({_id:key('fallos',correo)});
      if(record?.bloqueadoHasta>now()) reject(res,record.bloqueadoHasta);
    },
    async failed(req,res,correo) {
      const record=await increment('fallos',correo,true);
      if(record.intentos===5) await event(req,'alertaIngreso','umbral');
      if(record.bloqueadoHasta>now()) reject(res,record.bloqueadoHasta);
    },
    async success(correo) {await store.deleteOne({_id:key('fallos',correo)});},
    async recovery(req,res,correo) {
      await quota(req,res,'recuperacion-ip',req.ip,10);
      await quota(req,res,'recuperacion-correo',correo,3);
    },
    async exchange(req,res){await quota(req,res,'canje-ip',req.ip,30);}
  };
}
