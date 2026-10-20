import {CloudStore,validateConfig} from './cloud.mjs?v=066';
const $=selector=>document.querySelector(selector);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let cloud,portal=null,editing=null,pending=null,busy=false,selectedContainerId=null;
function message(value,error=false){$('#status').textContent=value;$('#status').classList.toggle('error',error)}
function resetForm(){editing=null;pending=null;selectedContainerId=null;$('#interventionForm').reset();$('#containerSearch').disabled=false;$('#containerChoices').hidden=true;$('#containerSearch').setAttribute('aria-expanded','false');$('#containerSelection').textContent='Choisissez un résultat dans la liste.';$('#preventiveChecklist').hidden=true;$('#preventivePoints').innerHTML='';$('#formTitle').textContent='Nouvelle intervention';$('#saveButton').textContent='Enregistrer';$('#cancelEdit').hidden=true;$('#formError').textContent='';}
function render(){
 $('#loginPanel').hidden=true;$('#workspace').hidden=false;$('#operatorName').textContent=cloud.session?.user?.email||'Compte opérateur';
 renderContainerChoices();
 $('#history').innerHTML=portal.interventions.length?portal.interventions.map(item=>`<article class="historyItem"><h3>${escapeHtml(item.containerNumber)}</h3><div class="historyMeta">${escapeHtml(new Date(item.date+'T12:00:00Z').toLocaleDateString('fr-FR',{timeZone:'UTC'}))} · ${escapeHtml(item.type)} · N° ${escapeHtml(item.number)}</div><p>${escapeHtml(item.comment)}</p>${item.type==='préventif'&&Object.keys(item.parts||{}).length?`<div class="historyMeta">Points vérifiés : ${Object.keys(item.parts).map(escapeHtml).join(', ')}</div>`:''}<button type="button" class="secondary" data-edit="${escapeHtml(item.id)}">Modifier</button></article>`).join(''):'<p>Aucune intervention enregistrée avec ce compte.</p>';
 $('#history').querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>{
  const item=portal.interventions.find(value=>value.id===button.dataset.edit);if(!item)return;
  editing=item;pending=null;selectedContainerId=item.containerId;$('#containerSearch').value=item.containerNumber;$('#containerSearch').disabled=true;$('#containerChoices').hidden=true;$('#containerSelection').textContent='Contenant sélectionné : '+item.containerNumber;
  $('#comment').value=item.comment;document.querySelectorAll('[name=type]').forEach(input=>input.checked=input.value===item.type);
  renderChecklist(item.checklistRecorded?item.parts||{}:null);$('#formTitle').textContent='Modifier mon intervention';$('#saveButton').textContent='Enregistrer la correction';$('#cancelEdit').hidden=false;$('#formError').textContent='';
  window.scrollTo({top:0,behavior:'smooth'});$('#comment').focus();
 });
}
async function refresh(){portal=await cloud.rpc('operator_portal_data',{});if(!Array.isArray(portal?.containers)||!Array.isArray(portal?.interventions))throw Error('Données du portail indisponibles.');if(portal.containers.some(c=>!Array.isArray(c.checks)))throw Error('La checklist nécessite le script Supabase 019.');render();}
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
document.querySelectorAll('[name=type]').forEach(input=>input.onchange=()=>{if(input.checked)document.querySelectorAll('[name=type]').forEach(other=>{if(other!==input)other.checked=false;});pending=null;renderChecklist();});
function renderChecklist(existingParts=null){
 const panel=$('#preventiveChecklist');panel.hidden=!document.querySelector('[name=type][value=préventif]').checked;
 if(panel.hidden){$('#preventivePoints').innerHTML='';return;}
 const container=editing||availableContainers().find(c=>c.id===selectedContainerId),checks=container?.checks||[];
 $('#preventiveHelp').textContent=!container?'Sélectionnez d’abord un contenant pour afficher ses points de contrôle.':checks.length?`Catégorie ${container.category||'non renseignée'} · Cochez les points vérifiés. Ils sont tous cochés au départ.`:'Aucun point de contrôle configuré pour cette catégorie.';
 $('#preventivePoints').innerHTML=checks.map((point,index)=>`<label><input type="checkbox" data-check-index="${index}" ${existingParts===null||Object.hasOwn(existingParts,point)?'checked':''}> ${escapeHtml(point)}</label>`).join('');
 $('#preventivePoints').querySelectorAll('input').forEach(input=>input.onchange=()=>{pending=null;});
}
function availableContainers(){
 const counts=new Map();for(const container of portal?.containers||[]){const key=String(container.number||'').trim().toLocaleLowerCase('fr');counts.set(key,(counts.get(key)||0)+1);}
 return (portal?.containers||[]).filter(container=>counts.get(String(container.number||'').trim().toLocaleLowerCase('fr'))===1);
}
function renderContainerChoices(){
 const query=$('#containerSearch').value.trim().toLocaleLowerCase('fr'),choices=$('#containerChoices');
 if(!portal||editing||!query){choices.hidden=true;$('#containerSearch').setAttribute('aria-expanded','false');return;}
 const matches=availableContainers().filter(c=>c.number.toLocaleLowerCase('fr').includes(query)).slice(0,8);
 choices.innerHTML=matches.length?matches.map(c=>`<button type="button" role="option" data-container-id="${escapeHtml(c.id)}">${escapeHtml(c.number)}</button>`).join(''):'<p>Aucun contenant existant ne correspond à ce numéro.</p>';
 choices.hidden=false;$('#containerSearch').setAttribute('aria-expanded','true');
 choices.querySelectorAll('[data-container-id]').forEach(button=>button.onclick=()=>{const container=availableContainers().find(c=>c.id===button.dataset.containerId);if(!container)return;selectedContainerId=container.id;$('#containerSearch').value=container.number;choices.hidden=true;$('#containerSearch').setAttribute('aria-expanded','false');$('#containerSelection').textContent='Contenant sélectionné : '+container.number;$('#formError').textContent='';pending=null;renderChecklist();});
}
$('#containerSearch').oninput=()=>{selectedContainerId=null;pending=null;$('#containerSelection').textContent='Choisissez un résultat dans la liste.';renderContainerChoices();renderChecklist();};
$('#comment').oninput=()=>{pending=null;};
$('#cancelEdit').onclick=resetForm;
$('#interventionForm').onsubmit=async event=>{
 event.preventDefault();if(busy)return;
 const container=availableContainers().find(c=>c.id===selectedContainerId),
  type=document.querySelector('[name=type]:checked')?.value,comment=$('#comment').value.trim();
 $('#formError').textContent='';message('');
 if(!container&&!editing){$('#formError').textContent='Sélectionnez un contenant existant dans les résultats. Un numéro saisi seul ne suffit pas.';return;}
 if(!type){$('#formError').textContent='Cochez un type d’intervention.';return;}
 if(!comment){$('#formError').textContent='Décrivez l’intervention dans le commentaire.';return;}
 const checks=editing?.checks||container?.checks||[];
 const checked_parts=type==='préventif'?Object.fromEntries([...$('#preventivePoints').querySelectorAll('input:checked')].map(input=>[checks[Number(input.dataset.checkIndex)],'Vérifié'])):{};
 const body={container_id:editing?.containerId||container.id,kind:type,comment,intervention_id:editing?.id||null,checked_parts};
 const signature=JSON.stringify(body);if(!pending||pending.signature!==signature)pending={id:crypto.randomUUID(),signature};
 busy=true;$('#saveButton').disabled=true;
 try{await cloud.rpc('operator_save_intervention_v2',{request_id:pending.id,...body},120000);await refresh();resetForm();message('Intervention enregistrée dans les Contenants.');}
 catch(error){$('#formError').textContent='Enregistrement non confirmé : '+error.message+' Les informations saisies sont conservées. Vous pouvez réessayer.';}
 finally{busy=false;$('#saveButton').disabled=false;}
};
start();
