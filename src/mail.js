import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';

export function delivery(config, env) {
  if(config.prod) {
    return async({correo,enlace})=>{
      if(!env.MAILERSEND_API_KEY || !env.MAILERSEND_FROM) throw Error('Correo de recuperación no configurado');
      const response=await fetch('https://api.mailersend.com/v1/email',{method:'POST',redirect:'error',
        headers:{Authorization:'Bearer '+env.MAILERSEND_API_KEY,'Content-Type':'application/json',
          'X-Requested-With':'XMLHttpRequest'},
        signal:AbortSignal.timeout(5000),body:JSON.stringify({from:{email:env.MAILERSEND_FROM,name:'SecureVault'},to:[{email:correo}],
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
