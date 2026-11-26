import assert from 'node:assert/strict';
import test from 'node:test';
import {delivery} from '../src/mail.js';

test('producción solicita el envío de recuperación a MailerSend',async()=>{
  const originalFetch=globalThis.fetch;
  let observed;
  globalThis.fetch=async(url,options)=>{
    observed={url,options};
    return new Response(null,{status:202});
  };
  try {
    const send=delivery({prod:true},{MAILERSEND_API_KEY:'test-only-token',MAILERSEND_FROM:'hello@trial.example'});
    await send({correo:'owner@example.test',enlace:'https://securevault.example/restablecer#token-ficticio'});
    assert.equal(observed.url,'https://api.mailersend.com/v1/email');
    assert.equal(observed.options.method,'POST');
    assert.equal(observed.options.headers.Authorization,'Bearer test-only-token');
    assert.equal(observed.options.headers['X-Requested-With'],'XMLHttpRequest');
    assert.deepEqual(JSON.parse(observed.options.body),{
      from:{email:'hello@trial.example',name:'SecureVault'},to:[{email:'owner@example.test'}],
      subject:'Recuperación de SecureVault',text:'Tu enlace de recuperación vence en 15 minutos.\nhttps://securevault.example/restablecer#token-ficticio'
    });
  } finally {
    globalThis.fetch=originalFetch;
  }
});
