import {CloudStore,validateConfig} from './cloud.mjs?v=060';
const $=selector=>document.querySelector(selector);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let cloud,portal=null,editing=null,pending=null,busy=false;
function message(value,error=false){$('#status').textContent=value;$('#status').classList.toggle('error',error)}
function resetForm(){editing=null;pending=null;$('#interventionForm').reset();$('#containerSearch').disabled=false;$('#formTitle').textContent='Nouvelle intervention';$('#saveButton').textContent='Enregistrer';$('#cancelEdit').hidden=true;$('#formError').textContent='';}
function render(){
 $('#loginPanel').hidden=true;$('#workspace').hidden=false;$('#operatorName').textContent=cloud.session?.user?.email||'Compte opérateur';
 $('#containerSuggestions').innerHTML=portal.containers.map(c=>`<option value="${escapeHtml(c.number)}"></option>`).join('');
 $('#history').innerHTML=portal.interventions.length?portal.interventions.map(item=>`<article class="historyItem"><h3>${escapeHtml(item.containerNumber)}</h3><div class="historyMeta">${escapeHtml(new Date(item.date+'T12:00:00Z').toLocaleDateString('fr-FR',{timeZone:'UTC'}))} · ${escapeHtml(item.type)} · N° ${escapeHtml(item.number)}</div><p>${escapeHtml(item.comment)}</p><button type="button" class="secondary" data-edit="${escapeHtml(item.id)}">Modifier</button></article>`).join(''):'<p>Aucune intervention enregistrée avec ce compte.</p>';
 $('#history').querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>{
  const item=portal.interventions.find(value=>value.id===button.dataset.edit);if(!item)return;
  editing=item;pending=null;$('#containerSearch').value=item.containerNumber;$('#containerSearch').disabled=true;
  $('#comment').value=item.comment;document.querySelectorAll('[name=type]').forEach(input=>input.checked=input.value===item.type);
  $('#formTitle').textContent='Modifier mon intervention';$('#saveButton').textContent='Enregistrer la correction';$('#cancelEdit').hidden=false;$('#formError').textContent='';
  window.scrollTo({top:0,behavior:'smooth'});$('#comment').focus();
 });
}
async function refresh(){portal=await cloud.rpc('operator_portal_data',{});if(!Array.isArray(portal?.containers)||!Array.isArray(portal?.interventions))throw Error('Données du portail indisponibles.');render();}
async function start(){
 try{const config=validateConfig(window.VGP_CLOUD);if(!config)throw Error('Le portail doit être ouvert sur le site Supabase configuré.');cloud=new CloudStore(config);if(cloud.session)await refresh();}
 catch(error){if(cloud?.session){await cloud.logout().catch(()=>{});$('#loginError').textContent='Ce compte ne dispose pas du rôle opérateur, ou la session a expiré. Reconnectez-vous.';}else $('#loginError').textContent=error.message;}
}
$('#loginForm').onsubmit=async event=>{
 event.preventDefault();const formElement=event.currentTarget,button=formElement.querySelector('button');button.disabled=true;$('#loginError').textContent='';
 try{const form=new FormData(formElement);await cloud.login(String(form.get('email')),String(form.get('password')));await refresh();message('Connexion réussie.');formElement.reset();}
 catch(error){$('#loginError').textContent=error.message;await cloud?.logout().catch(()=>{});}finally{button.disabled=false;}
};
$('#logout').onclick=async()=>{await cloud.logout();portal=null;resetForm();$('#workspace').hidden=true;$('#loginPanel').hidden=false;message('Vous êtes déconnecté.');};
document.querySelectorAll('[name=type]').forEach(input=>input.onchange=()=>{if(input.checked)document.querySelectorAll('[name=type]').forEach(other=>{if(other!==input)other.checked=false;});pending=null;});
$('#containerSearch').oninput=$('#comment').oninput=()=>{pending=null;};
$('#cancelEdit').onclick=resetForm;
$('#interventionForm').onsubmit=async event=>{
 event.preventDefault();if(busy)return;
 const number=$('#containerSearch').value.trim(),container=portal?.containers.find(c=>c.number.toLocaleLowerCase('fr')===number.toLocaleLowerCase('fr')),
  type=document.querySelector('[name=type]:checked')?.value,comment=$('#comment').value.trim();
 $('#formError').textContent='';message('');
 if(!container&&!editing){$('#formError').textContent='Choisissez un contenant proposé dans la liste.';return;}
 if(!type){$('#formError').textContent='Cochez un type d’intervention.';return;}
 if(!comment){$('#formError').textContent='Décrivez l’intervention dans le commentaire.';return;}
 const body={container_id:editing?.containerId||container.id,kind:type,comment,intervention_id:editing?.id||null};
 const signature=JSON.stringify(body);if(!pending||pending.signature!==signature)pending={id:crypto.randomUUID(),signature};
 busy=true;$('#saveButton').disabled=true;
 try{await cloud.rpc('operator_save_intervention',{request_id:pending.id,...body},120000);await refresh();resetForm();message('Intervention enregistrée dans les Contenants.');}
 catch(error){$('#formError').textContent='Enregistrement non confirmé : '+error.message+' Les informations saisies sont conservées. Vous pouvez réessayer.';}
 finally{busy=false;$('#saveButton').disabled=false;}
};
start();
