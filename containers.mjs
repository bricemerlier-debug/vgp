const containerParts=['Relâche','Élastique','Pompe','Frein','Inter','Roues','Carter','Bâti','Visserie','Rivets','Poignée','Palier','Timon','Pignon','Chaîne','Sabot','Sangle','Tambour','Verrou','Protection ressort','Ressort','Coupelle','Bâche','Bavette','Manchon','Excentrique','Bague','Galet','Enroulement / déroulement','Pédale','Amortisseur','Verrouillage','Levier','Rétroviseur','Vérin'];
const escContainer=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function containerPreventiveStatus(container, today=new Date()){
 const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const months=norm(container.subtype).includes('carcasse')?18:12;
 const last=(container.interventions||[]).filter(i=>norm(i.type).trim()==='preventif'&&/^\d{4}-\d{2}-\d{2}$/.test(i.date)).map(i=>i.date).sort().at(-1);
 if(!last)return {months,last:null,due:null,days:null,status:'unknown'};
 const [year,month,day]=last.split('-').map(Number);
 const target=new Date(Date.UTC(year,month-1+months,1));
 const lastDay=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
 target.setUTCDate(Math.min(day,lastDay));
 const due=target.toISOString().slice(0,10);
 const current=today instanceof Date?today.toISOString().slice(0,10):String(today).slice(0,10);
 const days=Math.round((Date.parse(due+'T00:00:00Z')-Date.parse(current+'T00:00:00Z'))/86400000);
 return {months,last,due,days,status:days<0?'overdue':days<=30?'soon':'current'};
}
export function containerRecordsValid(d){return d.containers===undefined||Array.isArray(d.containers)&&d.containers.every(c=>c&&typeof c.id==='string'&&typeof c.number==='string'&&c.number.trim()&&typeof c.type==='string'&&typeof c.subtype==='string'&&Array.isArray(c.interventions)&&c.interventions.every(i=>i&&typeof i.number==='string'&&typeof i.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(i.date)&&typeof i.controller==='string'&&typeof i.type==='string'&&typeof i.generalState==='string'&&typeof i.comment==='string'&&i.parts&&typeof i.parts==='object'&&!Array.isArray(i.parts)&&Object.entries(i.parts).every(([k,v])=>containerParts.includes(k)&&typeof v==='string')))&&new Set(d.containers.map(c=>c.id)).size===d.containers.length&&new Set(d.containers.map(c=>c.number.trim().toLocaleLowerCase('fr'))).size===d.containers.length&&new Set(d.containers.flatMap(c=>c.interventions.map(i=>c.number.trim().toLocaleLowerCase('fr')+'\u0000'+i.number.trim().toLocaleLowerCase('fr')))).size===d.containers.reduce((n,c)=>n+c.interventions.length,0)}

export function installContainersUI({root,read,save,canEdit,id,analyzeFiles}){
 let selected=null,editingContainerId=null,query='',importPlan=null,importSnapshot=null;
 const $=s=>document.querySelector(s), clean=s=>escContainer(s), state=()=>read().containers||[];
 const dateFr=s=>new Date(s+'T00:00:00').toLocaleDateString('fr-FR');
 const dueLabel=c=>{const p=containerPreventiveStatus(c);return p.due?`${dateFr(p.due)} · ${p.days<0?`${-p.days} j de retard`:p.days===0?'Aujourd’hui':`${p.days} j restants`}`:'À planifier · aucun préventif'};
 const dueClass=c=>`container-due container-due-${containerPreventiveStatus(c).status}`;
 function list(){selected=null;$('#containerListPane').hidden=false;$('#containerDetailPane').hidden=true;$('#containerAdd').hidden=false;$('#containerImportButton').hidden=false;renderList();}
 function populateCategories(subtypeValue=''){
  const sub=$('#containerSubtypeChoice'),previous=subtypeValue||sub.value;
  const subs=[...new Set(state().map(c=>c.subtype).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  sub.innerHTML='<option value="">Choisir un type de contenant</option>'+subs.map(v=>`<option value="${clean(v)}">${clean(v)}</option>`).join('')+'<option value="__other__">Autre…</option>';
  sub.value=subs.includes(previous)?previous:previous==='__other__'?'__other__':'';
  $('#containerForm [name=subtypeOther]').hidden=sub.value!=='__other__';
  $('#containerForm [name=subtypeOther]').required=sub.value==='__other__';
 }
 function renderList(){const all=state();populateCategories();const q=query.trim().toLocaleLowerCase('fr'),rows=all.filter(c=>`${c.number} ${c.subtype}`.toLocaleLowerCase('fr').includes(q)).sort((a,b)=>a.number.localeCompare(b.number,'fr',{numeric:true}));$('#containerCount').textContent=`${all.length} contenant${all.length===1?'':'s'} · ${all.reduce((n,c)=>n+c.interventions.length,0)} intervention${all.reduce((n,c)=>n+c.interventions.length,0)===1?'':'s'}`;$('#containerRows').innerHTML=rows.length?`<div class="owner-equipment-list"><table><thead><tr><th>N° d’équipement</th><th>Type de contenant</th><th>Prochain préventif</th><th>Dernière intervention</th><th>Interventions</th><th></th></tr></thead><tbody>${rows.map(c=>{const last=[...c.interventions].sort((a,b)=>b.date.localeCompare(a.date))[0];return `<tr><td><b>${clean(c.number)}</b></td><td>${clean(c.subtype)||'—'}</td><td><span class="${dueClass(c)}">${dueLabel(c)}</span></td><td>${last?new Date(last.date+'T00:00:00').toLocaleDateString('fr-FR'):'Aucune'}</td><td>${c.interventions.length}</td><td><button class="secondary" data-container-open="${clean(c.id)}">Ouvrir</button></td></tr>`}).join('')}</tbody></table></div>`:'<p class="empty">'+(all.length?'Aucun contenant ne correspond à la recherche.':'Aucun contenant enregistré. Vous pourrez créer les fiches manuellement ou les importer ultérieurement.')+'</p>';$('#containerRows').querySelectorAll('[data-container-open]').forEach(b=>b.onclick=()=>open(b.dataset.containerOpen));$('#containerAdd').disabled=!canEdit();$('#containerImportButton').disabled=!canEdit();}
 function open(idValue){const c=state().find(x=>x.id===idValue);if(!c)return;selected=c.id;$('#containerListPane').hidden=true;$('#containerDetailPane').hidden=false;$('#containerAdd').hidden=true;$('#containerImportButton').hidden=true;const last=[...c.interventions].sort((a,b)=>b.date.localeCompare(a.date))[0];$('#containerDetail').innerHTML=`<div class="toolbar"><div><p class="eyebrow">FICHE CONTENANT</p><h2>${clean(c.number)}</h2></div><div class="container-detail-actions"><button type="button" class="secondary" id="containerEdit">Modifier la fiche</button><button type="button" class="secondary" id="containerBack">← Tous les contenants</button></div></div><dl class="container-facts"><div><dt>Type de contenant</dt><dd>${clean(c.subtype)||'Non renseigné'}</dd></div><div><dt>Prochain préventif · tous les ${containerPreventiveStatus(c).months} mois</dt><dd class="${dueClass(c)}">${dueLabel(c)}</dd></div><div><dt>Dernière intervention</dt><dd>${last?new Date(last.date+'T00:00:00').toLocaleDateString('fr-FR'):'Aucune intervention'}</dd></div><div><dt>Nombre d’interventions</dt><dd>${c.interventions.length}</dd></div></dl><div class="toolbar"><h3>Historique des interventions</h3><button type="button" id="containerAddIntervention">+ Ajouter une intervention</button></div>${c.interventions.length?`<div class="owner-equipment-list"><table><thead><tr><th>N° intervention</th><th>Date</th><th>Type</th><th>Contrôleur</th><th>État général</th></tr></thead><tbody>${[...c.interventions].sort((a,b)=>b.date.localeCompare(a.date)).map(i=>`<tr><td><b>${clean(i.number)}</b></td><td>${new Date(i.date+'T00:00:00').toLocaleDateString('fr-FR')}</td><td>${clean(i.type)||'—'}</td><td>${clean(i.controller)||'—'}</td><td>${clean(i.generalState)||'—'}<details><summary>Détails</summary><p>${clean(i.comment)||'Aucun commentaire'}</p><dl class="container-parts">${containerParts.filter(p=>i.parts[p]).map(p=>`<div><dt>${clean(p)}</dt><dd>${clean(i.parts[p])}</dd></div>`).join('')}</dl></details></td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">Aucune intervention enregistrée sur ce contenant.</p>'}`;$('#containerBack').onclick=list;$('#containerEdit').disabled=!canEdit();$('#containerEdit').onclick=()=>openEdit(c);$('#containerAddIntervention').disabled=!canEdit();$('#containerAddIntervention').onclick=()=>openIntervention(c);}
 function openEdit(c){
  if(!canEdit())return;
  editingContainerId=c.id;
  const form=$('#containerForm');form.reset();
  form.elements.number.value=c.number;
  populateCategories(c.subtype);
  $('#containerFormTitle').textContent=`Modifier le contenant · ${c.number}`;
  $('#containerFormSubmit').textContent='Enregistrer les modifications';
  $('#containerFormError').textContent='';$('#containerFormStatus').textContent='';
  $('#containerDialog').showModal();
 }
 function openIntervention(c){const form=$('#containerInterventionForm');form.reset();form.elements.number.value='';form.elements.date.value=new Date().toISOString().slice(0,10);$('#containerInterventionTitle').textContent=`Nouvelle intervention · ${c.number}`;$('#containerPartFields').innerHTML=containerParts.map(p=>`<label>${clean(p)}<select data-native-select name="part:${clean(p)}"><option value="">Non renseigné</option><option>OK</option><option>À réparer</option><option>À remplacer</option><option>Sans objet</option></select></label>`).join('');$('#containerInterventionError').textContent='';$('#containerInterventionStatus').textContent='';$('#containerInterventionDialog').showModal();}
 $('#containerSearch').oninput=e=>{query=e.target.value;renderList()};$('#containerAdd').onclick=()=>{const f=$('#containerForm');f.reset();populateCategories();editingContainerId=null;$('#containerFormTitle').textContent='Créer une fiche contenant';$('#containerFormSubmit').textContent='Créer la fiche';$('#containerFormError').textContent='';$('#containerFormStatus').textContent='';$('#containerDialog').showModal()};$('#containerSubtypeChoice').onchange=e=>{const other=e.target.value==='__other__';$('#containerForm [name=subtypeOther]').hidden=!other;$('#containerForm [name=subtypeOther]').required=other;};
 $('#containerForm').onsubmit=async e=>{
  e.preventDefault();if(!canEdit())return;
  const form=e.currentTarget,button=$('#containerFormSubmit'),values=new FormData(form);
  const number=String(values.get('number')).trim(),currentId=editingContainerId;
  $('#containerFormError').textContent='';
  if(state().some(c=>c.id!==currentId&&c.number.trim().toLocaleLowerCase('fr')===number.toLocaleLowerCase('fr'))){$('#containerFormError').textContent='Ce numéro de contenant existe déjà.';return;}
  const type=/^[A-Za-z]{2}/.exec(number)?.[0].toUpperCase()||'';
  const subtype=String(values.get('subtype'))==='__other__'?String(values.get('subtypeOther')).trim():String(values.get('subtype')).trim();
  if(!number||!type||!subtype){$('#containerFormError').textContent='Renseignez un numéro commençant par deux lettres et le type de contenant.';return;}
  const next=structuredClone(read());next.containers??=[];
  const existing=currentId&&next.containers.find(c=>c.id===currentId);
  if(currentId&&!existing){$('#containerFormError').textContent='Cette fiche est introuvable. Actualisez la page.';return;}
  const savedId=existing?.id||id();
  if(existing)Object.assign(existing,{number,type,subtype});
  else next.containers.push({id:savedId,number,type,subtype,interventions:[]});
  button.disabled=true;$('#containerFormStatus').textContent='Enregistrement en cours…';
  const ok=await save(next,false,{timeoutMs:120000,renderAfter:false});
  button.disabled=false;$('#containerFormStatus').textContent='';
  if(ok){$('#containerDialog').close();renderList();open(savedId);}
  else $('#containerFormError').textContent=$('#message').textContent||'Enregistrement impossible. Actualisez la page avant de réessayer.';
 };
 $('#containerInterventionForm').onsubmit=async e=>{
  e.preventDefault();if(!canEdit())return;
  const form=e.currentTarget,button=$('#containerInterventionSubmit'),values=new FormData(form);
  const number=String(values.get('number')).trim(),current=state().find(c=>c.id===selected);
  $('#containerInterventionError').textContent='';
  if(!current){$('#containerInterventionError').textContent='Cette fiche est introuvable. Actualisez la page.';return;}
  if(current.interventions.some(i=>i.number.trim().toLocaleLowerCase('fr')===number.toLocaleLowerCase('fr'))){$('#containerInterventionError').textContent='Ce numéro d’intervention existe déjà pour ce contenant.';return;}
  const parts=Object.fromEntries(containerParts.map(p=>[p,String(values.get('part:'+p)||'')]).filter(([,v])=>v));
  const next=structuredClone(read()),container=next.containers.find(c=>c.id===selected);
  if(!container){$('#containerInterventionError').textContent='Cette fiche est introuvable. Actualisez la page.';return;}
  container.interventions.push({number,date:String(values.get('date')),controller:String(values.get('controller')).trim(),type:String(values.get('type')).trim(),generalState:String(values.get('generalState')).trim(),comment:String(values.get('comment')).trim(),parts});
  button.disabled=true;$('#containerInterventionStatus').textContent='Enregistrement en cours…';
  const ok=await save(next,false,{timeoutMs:120000,renderAfter:false});
  button.disabled=false;$('#containerInterventionStatus').textContent='';
  if(ok){$('#containerInterventionDialog').close();open(container.id);}
  else $('#containerInterventionError').textContent=$('#message').textContent||'Enregistrement impossible. Actualisez la page avant de réessayer.';
 };
 $('#containerImportButton').onclick=()=>{importPlan=null;importSnapshot=null;$('#containerImportFiles').value='';$('#containerImportStatus').textContent='';$('#containerImportPreview').innerHTML='';$('#containerImportError').textContent='';$('#containerImportConfirmed').checked=false;$('#containerImportConfirmRow').hidden=true;$('#containerImportApply').disabled=true;$('#containerImportDialog').showModal()};$('#containerImportFiles').onchange=async e=>{importPlan=null;$('#containerImportApply').disabled=true;$('#containerImportConfirmRow').hidden=true;$('#containerImportPreview').innerHTML='';$('#containerImportError').textContent='';const files=[...e.target.files];if(!files.length)return;$('#containerImportStatus').textContent=`Analyse locale de ${files.length} classeur(s)…`;try{importSnapshot=JSON.stringify(state());importPlan=await analyzeFiles(files,state());const p=importPlan;$('#containerImportStatus').textContent=`${p.files.length} fichier(s) · ${p.rows} ligne(s) lue(s) · ${p.addedContainers} fiche(s) contenant créée(s) · ${p.addedInterventions} intervention(s) rangée(s) dans leur fiche · ${p.recoveredContainerNumbers} numéro(s) retrouvé(s) sans ambiguïté dans un autre classeur · ${p.duplicates} doublon(s) ignoré(s) · ${p.errors} ligne(s) à vérifier.`;const items=[...p.issues.map(r=>({...r,kind:'À vérifier'})),...p.conflicts.map(r=>({...r,kind:'Type conservé'}))];$('#containerImportPreview').innerHTML=(p.reasons.length?`<p><b>Lignes ignorées par motif :</b> ${p.reasons.map(r=>`${r.count} · ${clean(r.reason)}`).join(' ; ')}</p>`:'')+(items.length?`<details open><summary>Détails affichés (${Math.min(items.length,40)} sur ${p.issueCount+p.conflictCount} lignes à vérifier)</summary><div class="owner-equipment-list"><table><thead><tr><th>Fichier / ligne</th><th>Contenant</th><th>Intervention</th><th>Analyse</th></tr></thead><tbody>${items.map(r=>`<tr><td>${clean(r.file)} · ${r.line}</td><td>${clean(r.number)||'—'}</td><td>${clean(r.intervention)||'—'}</td><td>${clean(r.kind)} · ${clean(r.reason)}</td></tr>`).join('')}</tbody></table></div></details>`:'<p>Aucune ligne à vérifier. Les doublons seront ignorés et aucune fiche existante ne sera remplacée.</p>');const ready=p.addedContainers+p.addedInterventions>0;$('#containerImportConfirmRow').hidden=!ready;$('#containerImportApply').disabled=!ready||!canEdit();}catch(error){$('#containerImportError').textContent=error.message;$('#containerImportStatus').textContent='Analyse interrompue.';}};$('#containerImportConfirmed').onchange=()=>{$('#containerImportApply').disabled=!importPlan||!$('#containerImportConfirmed').checked||!canEdit()};$('#containerImportApply').onclick=async()=>{if(!importPlan||!$('#containerImportConfirmed').checked)return;if(importSnapshot!==JSON.stringify(state())){$('#containerImportError').textContent='Les contenants ont changé depuis l’analyse. Relancez l’aperçu avant de confirmer.';return;}const next=structuredClone(read());next.containers=importPlan.containers;$('#containerImportApply').disabled=true;$('#containerImportStatus').textContent='Enregistrement des fiches et interventions… Cela peut prendre jusqu’à 2 minutes.';if(await save(next,false,{timeoutMs:120000,renderAfter:false})){$('#containerImportDialog').close();list();}else{$('#containerImportStatus').textContent='Enregistrement non confirmé.';$('#containerImportError').textContent=$('#message').textContent||'Actualisez la page et vérifiez les contenants avant un nouvel essai.';importPlan=null;$('#containerImportConfirmed').checked=false;$('#containerImportConfirmRow').hidden=true;}};
 return {render:renderList,list,open,validate:containerRecordsValid};
}
