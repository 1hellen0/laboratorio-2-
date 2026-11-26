'use strict';
const resetToken=document.querySelector('form[action="/api/restablecer"] input[name="token"]');
if(resetToken){
  resetToken.value=location.hash.slice(1);
  history.replaceState(null,'',location.pathname);
}
document.addEventListener('submit', async event => {
  const form=event.target;
  if (!(form instanceof HTMLFormElement) || form.method !== 'post') return;
  event.preventDefault();
  const status=document.getElementById('estado');
  const button=event.submitter;
  if(button) button.disabled=true;
  try {
    const response=await fetch(form.action,{method:'POST',headers:{'Content-Type':'application/json','X-SecureVault':'1'},
      body:JSON.stringify(Object.fromEntries(new FormData(form)))});
    if(!response.ok){status.textContent=(await response.json()).mensaje;return;}
    if(form.dataset.next) location.assign(form.dataset.next);
    else status.textContent=(await response.json()).mensaje;
  } catch {status.textContent='No se pudo completar la solicitud.';}
  finally {if(button) button.disabled=false;}
});
