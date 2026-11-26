import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';

export function delivery(config, env) {
  if(config.prod) {
    if(!env.RESEND_API_KEY || !env.MAIL_FROM) throw Error('Falta configuración del correo de producción');
    return async({correo,enlace})=>{
      const response=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'error',
        headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},
        signal:AbortSignal.timeout(5000),body:JSON.stringify({from:env.MAIL_FROM,to:[correo],
          subject:'Recuperación de SecureVault',text:'Tu enlace de recuperación vence en 15 minutos.\n'+enlace})});
      if(!response.ok) throw Error('Entrega rechazada');
    };
  }
  const directory=resolve('.local','buzon');
  return async message=>{
    await mkdir(directory,{recursive:true,mode:0o700});
    await writeFile(join(directory,randomUUID()+'.json'),JSON.stringify(message),{mode:0o600,flag:'wx'});
  };
}
