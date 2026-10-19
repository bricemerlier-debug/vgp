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
export function containerAnnualActivity(containers,year){
 const months=Array.from({length:12},(_,index)=>({month:index+1,actions:[],preventive:0,other:0,due:0}));
 for(const container of containers){
  const preventiveDates=[];
  for(const intervention of container.interventions||[]){
   const date=String(intervention.date||'');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
   const isPreventive=String(intervention.type||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()==='preventif';
   if(isPreventive)preventiveDates.push(date);
   if(Number(date.slice(0,4))!==year)continue;
   const month=months[Number(date.slice(5,7))-1];
   if(!month)continue;
   month.actions.push({containerId:container.id,containerNumber:container.number,intervention});
   if(isPreventive)month.preventive++;else month.other++;
  }
  const interval=containerPreventiveStatus(container).months;
  const dates=[...new Set(preventiveDates)].sort();
  for(let i=0;i<dates.length;i++){
   const [y,m,d]=dates[i].split('-').map(Number);
   const target=new Date(Date.UTC(y,m-1+interval,1));
   const lastDay=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
   target.setUTCDate(Math.min(d,lastDay));
   const due=target.toISOString().slice(0,10);
   if(dates[i+1]&&dates[i+1]<due)continue;
   if(Number(due.slice(0,4))===year)months[Number(due.slice(5,7))-1].due++;
  }
 }
 return months;
}
export function containerRecordsValid(d){return d.containers===undefined||Array.isArray(d.containers)&&d.containers.every(c=>c&&typeof c.id==='string'&&typeof c.number==='string'&&c.number.trim()&&typeof c.type==='string'&&typeof c.subtype==='string'&&Array.isArray(c.interventions)&&c.interventions.every(i=>i&&typeof i.number==='string'&&typeof i.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(i.date)&&typeof i.controller==='string'&&typeof i.type==='string'&&typeof i.generalState==='string'&&typeof i.comment==='string'&&i.parts&&typeof i.parts==='object'&&!Array.isArray(i.parts)&&Object.entries(i.parts).every(([k,v])=>containerParts.includes(k)&&typeof v==='string')))&&new Set(d.containers.map(c=>c.id)).size===d.containers.length&&new Set(d.containers.map(c=>c.number.trim().toLocaleLowerCase('fr'))).size===d.containers.length&&new Set(d.containers.flatMap(c=>c.interventions.map(i=>c.number.trim().toLocaleLowerCase('fr')+'\u0000'+i.number.trim().toLocaleLowerCase('fr')))).size===d.containers.reduce((n,c)=>n+c.interventions.length,0)}

export const containerReportTypes=[
 ['Pli AMIENS',['PLI AMIENS']],
 ['Cartouches PLT2',['PLT2','CARTOUCHE PLT2','CARTOUCHES PLT2']],
 ['Cassettes R2 - BLEU',['R2 BLEU','CASSETTE R2 BLEU','CASSETTES R2 BLEU']],
 ['Cassettes R2 - JAUNE',['R2 JAUNE','CASSETTE R2 JAUNE','CASSETTES R2 JAUNE']],
 ['Cassettes R2 - VERTE',['R2 VERTE','CASSETTE R2 VERTE','CASSETTES R2 VERTE']],
 ['Carcasses - PLAT',['CARCASSE PLAT','CARCASSES PLAT']],
 ['Carcasses - BACHE',['CARCASSE BACHE','CARCASSES BACHE']],
 ['GDF',['GDF']],['PC',['PC']],['Chariots',['CHARIOT','CHARIOTS']],
 ['Tracteurs',['TRACTEUR','TRACTEURS']],['Divers',[]]
];
export function containerReportCategory(subtype){
 const normalized=String(subtype||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
 return containerReportTypes.find(([label,aliases])=>label!=='Divers'&&aliases.includes(normalized))?.[0]||'Divers';
}
export function containerMonthlyReport(containers,year,month){
 const period=`${year}-${String(month).padStart(2,'0')}`;
 const groups=new Map(containerReportTypes.map(([type])=>[type,{type,containers:0,interventions:0}]));
 for(const container of containers){
  const matches=(container.interventions||[]).filter(i=>String(i.date||'').slice(0,7)===period);
  if(!matches.length)continue;
  const group=groups.get(containerReportCategory(container.subtype));
  group.containers++;
  group.interventions+=matches.length;
 }
 const values=[...groups.values()];
 return {year,month,total:values.reduce((sum,g)=>sum+g.containers,0),interventions:values.reduce((sum,g)=>sum+g.interventions,0),groups:values};
}

export function containerStatusCounts(containers,today=new Date()){
 const counts={current:0,overdue:0,unknown:0};
 for(const container of containers){
  const status=containerPreventiveStatus(container,today).status;
  if(status==='overdue')counts.overdue++;
  else if(status==='unknown')counts.unknown++;
  else counts.current++;
 }
 return counts;
}

export function filterContainerList(containers,{query='',types=[],statuses=[]}={},today=new Date()){
 const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g,' ').trim();
 const terms=normalize(query).split(/\s+/).filter(Boolean);
 const selectedTypes=new Set(types),selectedStatuses=new Set(statuses);
 return containers.filter(container=>{
  if(terms.length&&!terms.every(term=>normalize(`${container.number} ${container.subtype}`).split(' ').some(word=>word.startsWith(term))))return false;
  if(selectedTypes.size&&!selectedTypes.has(container.subtype||''))return false;
  const status=containerPreventiveStatus(container,today).status;
  return !selectedStatuses.size||selectedStatuses.has(status==='soon'?'current':status);
 });
}

export function sortContainerList(containers, key='number', direction='asc'){
 const collator=new Intl.Collator('fr',{numeric:true,sensitivity:'base'});
 const lastDate=c=>(c.interventions||[]).reduce((latest,i)=>i.date>latest?i.date:latest,'');
 const value=c=>key==='subtype'?c.subtype||'':key==='due'?containerPreventiveStatus(c).due||'':key==='last'?lastDate(c):key==='count'?(c.interventions||[]).length:c.number||'';
 return [...containers].sort((a,b)=>{
  const av=value(a),bv=value(b);
  if(av===''||bv==='')return av===''&&bv===''?collator.compare(a.number,b.number):av===''?1:-1;
  const comparison=key==='count'?av-bv:collator.compare(av,bv);
  return (direction==='desc'?-1:1)*comparison||collator.compare(a.number,b.number);
 });
}

export function installContainersUI({root,read,save,saveContainers,canEdit,id,analyzeFiles}){
 let selected=null,editingContainerId=null,query='',selectedTypes=new Set(),selectedStatuses=new Set(),typeOptionsKey='',sortKey='number',sortDirection='asc',importPlan=null,importSnapshot=null,activeTab='list',kpiYear=new Date().getFullYear(),reportDate=new Date();
 reportDate.setDate(1);reportDate.setMonth(reportDate.getMonth()-1);
 let reportYear=reportDate.getFullYear(),reportMonth=reportDate.getMonth()+1;
 const $=s=>document.querySelector(s), clean=s=>escContainer(s), state=()=>read().containers||[];
 const dateFr=s=>new Date(s+'T00:00:00').toLocaleDateString('fr-FR');
 const dueLabel=c=>{const p=containerPreventiveStatus(c);return p.due?`${dateFr(p.due)} · ${p.days<0?`${-p.days} j de retard`:p.days===0?'Aujourd’hui':`${p.days} j restants`}`:'À planifier · aucun préventif'};
 const dueClass=c=>`container-due container-due-${containerPreventiveStatus(c).status}`;
 function list(){selected=null;$('#containerListPane').hidden=false;$('#containerDetailPane').hidden=true;$('#containerAdd').hidden=false;$('#containerImportButton').hidden=false;renderList();}
 function switchTab(tab){
  activeTab=tab;
  $('#containerListTab').setAttribute('aria-selected',tab==='list');
  $('#containerKpiTab').setAttribute('aria-selected',tab==='kpi');
  $('#containerReportTab').setAttribute('aria-selected',tab==='report');
  $('#containerListPanel').hidden=tab!=='list';
  $('#containerKpiPanel').hidden=tab!=='kpi';
  $('#containerReportPanel').hidden=tab!=='report';
  if(tab==='list')list();else{$('#containerAdd').hidden=true;$('#containerImportButton').hidden=true;if(tab==='kpi')renderKpi();else renderReport();}
 }
 $('#containerListTab').onclick=()=>switchTab('list');
 $('#containerKpiTab').onclick=()=>switchTab('kpi');
 $('#containerReportTab').onclick=()=>switchTab('report');
 $('#containerReportMonth').onchange=e=>{const [year,month]=e.target.value.split('-').map(Number);if(year>=2026&&month>=1&&month<=12&&e.target.value<=$('#containerReportMonth').max){reportYear=year;reportMonth=month;renderReport()}};
 $('#containerReportJanuary').onclick=()=>{reportYear=2026;reportMonth=1;renderReport()};
 $('#containerReportPrint').onclick=()=>window.print();
 $('#containerReportDownload').onclick=async()=>{
  const button=$('#containerReportDownload');button.disabled=true;
  try{
   const response=await fetch('assets/container-report-template.pptx');
   if(!response.ok)throw new Error('Modèle PowerPoint introuvable.');
   const report=containerMonthlyReport(state(),reportYear,reportMonth);
   const month=new Intl.DateTimeFormat('fr-FR',{month:'long'}).format(new Date(reportYear,reportMonth-1,1));
   const bytes=globalThis.VGPFillContainerReportPptx(new Uint8Array(await response.arrayBuffer()),{month,year:reportYear,counts:report.groups.map(g=>g.containers),total:report.total});
   const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}));
   const link=document.createElement('a');link.href=url;link.download=`bilan-contenants-${reportYear}-${String(reportMonth).padStart(2,'0')}.pptx`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(error){alert(error.message||'Téléchargement impossible.')}finally{button.disabled=false}
 };
 $('#containerKpiYear').onchange=e=>{const year=Number(e.target.value);if(Number.isInteger(year)&&year>=1900&&year<=9999){kpiYear=year;renderKpi()}else e.target.value=kpiYear;};
 $('#containerKpiPreviousYear').onclick=()=>{if(kpiYear>1900){kpiYear--;renderKpi();}};
 $('#containerKpiNextYear').onclick=()=>{if(kpiYear<9999){kpiYear++;renderKpi();}};

 function populateCategories(subtypeValue=''){
  const sub=$('#containerSubtypeChoice'),previous=subtypeValue||sub.value;
  const subs=[...new Set(state().map(c=>c.subtype).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  sub.innerHTML='<option value="">Choisir un type de contenant</option>'+subs.map(v=>`<option value="${clean(v)}">${clean(v)}</option>`).join('')+'<option value="__other__">Autre…</option>';
  sub.value=subs.includes(previous)?previous:previous==='__other__'?'__other__':'';
  $('#containerForm [name=subtypeOther]').hidden=sub.value!=='__other__';
  $('#containerForm [name=subtypeOther]').required=sub.value==='__other__';
 }
 function renderReport(){
  const period=`${reportYear}-${String(reportMonth).padStart(2,'0')}`;
  const latest=new Date();latest.setDate(1);latest.setMonth(latest.getMonth()-1);
  $('#containerReportMonth').max=`${latest.getFullYear()}-${String(latest.getMonth()+1).padStart(2,'0')}`;
  $('#containerReportMonth').value=period;
  const monthName=new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(new Date(reportYear,reportMonth-1,1));
  const report=containerMonthlyReport(state(),reportYear,reportMonth);
  $('#containerReportPeriod').textContent=`Bilan mois de ${monthName.split(' ')[0].toLocaleUpperCase('fr')}`;
  $('#containerReportInterventions').textContent=`${report.interventions} intervention${report.interventions===1?'':'s'} enregistrée${report.interventions===1?'':'s'}`;
  $('#containerReportRows').innerHTML=report.groups.map((group,index)=>`<tr><th scope="row">${clean(group.type)}</th><td>${group.containers}</td>${index===0?`<td id="containerReportTotalCell" rowspan="${report.groups.length}">${report.total}</td>`:''}</tr>`).join('');
 }
 function renderKpi(){
  const names=['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  const months=containerAnnualActivity(state(),kpiYear);
  const total=months.reduce((n,m)=>n+m.actions.length,0);
  $('#containerKpiYear').value=kpiYear;
  $('#containerKpiTotal').textContent=`${total} intervention${total===1?'':'s'} réalisée${total===1?'':'s'} en ${kpiYear}`;
  const previousTotal=containerAnnualActivity(state(),kpiYear-1).reduce((n,m)=>n+m.actions.length,0),difference=total-previousTotal;
  $('#containerKpiComparison').textContent=`${kpiYear-1} : ${previousTotal} intervention${previousTotal===1?'':'s'} · Écart : ${difference>0?'+':''}${difference}`;
  $('#containerKpiPreviousYear').disabled=kpiYear<=1900;$('#containerKpiNextYear').disabled=kpiYear>=9999;
  const max=Math.max(1,...months.map(m=>m.actions.length));
  const ticks=[0,Math.ceil(max/4),Math.ceil(max/2),Math.ceil(max*3/4),max].filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
  const y=count=>220-count/max*170;
  const points=months.map((m,i)=>`${55+i*65},${y(m.actions.length)}`).join(' ');
  $('#containerKpiChart').innerHTML=`<svg viewBox="0 0 810 265" role="img" aria-label="Nombre d’interventions réalisées chaque mois en ${kpiYear}">${ticks.map(n=>`<line x1="45" x2="790" y1="${y(n)}" y2="${y(n)}" stroke="#dce5ef"/><text x="3" y="${y(n)+4}" fill="#60748e" font-size="11">${n}</text>`).join('')}<polyline fill="none" stroke="#0057a8" stroke-width="3" points="${points}"/>${months.map((m,i)=>`<circle cx="${55+i*65}" cy="${y(m.actions.length)}" r="5" fill="#0057a8"/><text x="${55+i*65}" y="${y(m.actions.length)-12}" text-anchor="middle" font-size="12" fill="#193f69">${m.actions.length}</text>`).join('')}${names.map((name,i)=>`<text x="${55+i*65}" y="252" text-anchor="middle" font-size="12" fill="#60748e">${name}</text>`).join('')}</svg>`;
  $('#containerKpiCards').innerHTML=months.map((m,i)=>`<article class="container-kpi-card"><h3>${names[i]}</h3><strong>${m.actions.length}</strong><p>intervention${m.actions.length===1?'':'s'} réalisée${m.actions.length===1?'':'s'}</p><small>${m.preventive} préventif${m.preventive===1?'':'s'} · ${m.other} autre${m.other===1?'':'s'}</small><small>${m.due} échéance${m.due===1?'':'s'} préventive${m.due===1?'':'s'} connue${m.due===1?'':'s'}</small><button type="button" class="secondary" data-container-kpi-month="${i}" ${m.actions.length?'':'disabled'}>Voir les interventions</button></article>`).join('');
  $('#containerKpiCards').querySelectorAll('[data-container-kpi-month]').forEach(button=>button.onclick=()=>{
   const month=months[Number(button.dataset.containerKpiMonth)];
   $('#containerKpiMonthTitle').textContent=`Interventions de ${names[month.month-1]} ${kpiYear}`;
   $('#containerKpiMonthRows').innerHTML=`<div class="owner-equipment-list"><table><thead><tr><th>Contenant</th><th>Intervention</th><th>Date</th><th>Type</th><th></th></tr></thead><tbody>${[...month.actions].sort((a,b)=>b.intervention.date.localeCompare(a.intervention.date)).map(a=>`<tr><td>${clean(a.containerNumber)}</td><td>${clean(a.intervention.number)}</td><td>${dateFr(a.intervention.date)}</td><td>${clean(a.intervention.type)||'—'}</td><td><button type="button" class="secondary" data-container-kpi-open="${clean(a.containerId)}">Ouvrir</button></td></tr>`).join('')}</tbody></table></div>`;
   $('#containerKpiMonthDetails').hidden=false;
   $('#containerKpiMonthDetails').scrollIntoView({block:'nearest',behavior:'smooth'});
   $('#containerKpiMonthRows').querySelectorAll('[data-container-kpi-open]').forEach(openButton=>openButton.onclick=()=>{switchTab('list');open(openButton.dataset.containerKpiOpen)});
  });
  $('#containerKpiMonthDetails').hidden=true;
 }
 function renderTypeFilters(all){
  const types=[...new Set(all.map(c=>c.subtype||''))].sort((a,b)=>a.localeCompare(b,'fr'));
  const key=JSON.stringify(types);
  if(key===typeOptionsKey)return;
  typeOptionsKey=key;
  selectedTypes=new Set([...selectedTypes].filter(type=>types.includes(type)));
  $('#containerTypeFilters').innerHTML=types.map(type=>`<label><input type="checkbox" value="${clean(type)}" ${selectedTypes.has(type)?'checked':''}>${clean(type)||'Sans type'}</label>`).join('')||'<span class="foot">Aucun type disponible.</span>';
 }
 function renderList(){
  const all=state();populateCategories();renderTypeFilters(all);
  const filtered=filterContainerList(all,{query,types:[...selectedTypes],statuses:[...selectedStatuses]});
  const rows=sortContainerList(filtered,sortKey,sortDirection);
  $('#containerCount').textContent=`${filtered.length} contenant${filtered.length===1?'':'s'} affiché${filtered.length===1?'':'s'} sur ${all.length} · ${filtered.reduce((n,c)=>n+c.interventions.length,0)} intervention${filtered.reduce((n,c)=>n+c.interventions.length,0)===1?'':'s'}`;
  const counts=containerStatusCounts(filtered);
  $('#containerCurrentCount').textContent=counts.current;
  $('#containerOverdueCount').textContent=counts.overdue;
  $('#containerUnknownCount').textContent=counts.unknown;
 $('#containerRows').innerHTML=rows.length?`<div class="owner-equipment-list"><table><thead><tr>${[['number','N° d’équipement'],['subtype','Type de contenant'],['due','Prochain préventif'],['last','Dernière intervention'],['count','Interventions']].map(([key,label])=>`<th scope="col" aria-sort="${sortKey===key?sortDirection==='asc'?'ascending':'descending':'none'}"><button type="button" class="container-sort" data-container-sort="${key}" aria-label="Trier par ${label}, ${sortKey===key&&sortDirection==='asc'?'ordre décroissant':'ordre croissant'}">${label}<span aria-hidden="true">${sortKey===key?sortDirection==='asc'?' ↑':' ↓':' ↕'}</span></button></th>`).join('')}<th scope="col"><span class="sr-only">Action</span></th></tr></thead><tbody>${rows.map(c=>{const last=[...c.interventions].sort((a,b)=>b.date.localeCompare(a.date))[0];return `<tr><td><b>${clean(c.number)}</b></td><td>${clean(c.subtype)||'—'}</td><td><span class="${dueClass(c)}">${dueLabel(c)}</span></td><td>${last?new Date(last.date+'T00:00:00').toLocaleDateString('fr-FR'):'Aucune'}</td><td>${c.interventions.length}</td><td><button class="secondary" data-container-open="${clean(c.id)}">Ouvrir</button></td></tr>`}).join('')}</tbody></table></div>`:'<p class="empty">'+(all.length?'Aucun contenant ne correspond à la recherche.':'Aucun contenant enregistré. Vous pourrez créer les fiches manuellement ou les importer ultérieurement.')+'</p>';$('#containerRows').querySelectorAll('[data-container-sort]').forEach(b=>b.onclick=()=>{const key=b.dataset.containerSort;sortDirection=sortKey===key?(sortDirection==='asc'?'desc':'asc'):(key==='count'||key==='last'?'desc':'asc');sortKey=key;renderList();$('#containerRows').querySelector(`[data-container-sort=\"${key}\"]`)?.focus()});$('#containerRows').querySelectorAll('[data-container-open]').forEach(b=>b.onclick=()=>open(b.dataset.containerOpen));$('#containerAdd').disabled=!canEdit();$('#containerImportButton').disabled=!canEdit();}
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
 $('#containerTypeFilters').onchange=e=>{if(e.target.type!=='checkbox')return;e.target.checked?selectedTypes.add(e.target.value):selectedTypes.delete(e.target.value);renderList()};
 $('#containerStatusFilters').onchange=e=>{if(e.target.type!=='checkbox')return;e.target.checked?selectedStatuses.add(e.target.value):selectedStatuses.delete(e.target.value);renderList()};
 $('#containerClearFilters').onclick=()=>{query='';selectedTypes.clear();selectedStatuses.clear();$('#containerSearch').value='';$('#containerTypeFilters').querySelectorAll('input').forEach(input=>input.checked=false);$('#containerStatusFilters').querySelectorAll('input').forEach(input=>input.checked=false);renderList()};
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
  const ok=await (saveContainers?saveContainers(next):save(next,false,{timeoutMs:120000,renderAfter:false}));
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
  const ok=await (saveContainers?saveContainers(next):save(next,false,{timeoutMs:120000,renderAfter:false}));
  button.disabled=false;$('#containerInterventionStatus').textContent='';
  if(ok){$('#containerInterventionDialog').close();open(container.id);}
  else $('#containerInterventionError').textContent=$('#message').textContent||'Enregistrement impossible. Actualisez la page avant de réessayer.';
 };
 $('#containerImportButton').onclick=()=>{importPlan=null;importSnapshot=null;$('#containerImportFiles').value='';$('#containerImportStatus').textContent='';$('#containerImportPreview').innerHTML='';$('#containerImportError').textContent='';$('#containerImportConfirmed').checked=false;$('#containerImportConfirmRow').hidden=true;$('#containerImportApply').disabled=true;$('#containerImportDialog').showModal()};$('#containerImportFiles').onchange=async e=>{importPlan=null;$('#containerImportApply').disabled=true;$('#containerImportConfirmRow').hidden=true;$('#containerImportPreview').innerHTML='';$('#containerImportError').textContent='';const files=[...e.target.files];if(!files.length)return;$('#containerImportStatus').textContent=`Analyse locale de ${files.length} classeur(s)…`;try{importSnapshot=JSON.stringify(state());importPlan=await analyzeFiles(files,state());const p=importPlan;const estimatedBytes=new TextEncoder().encode(JSON.stringify({...read(),containers:p.containers})).length;p.estimatedBytes=estimatedBytes;$('#containerImportStatus').textContent=`${p.files.length} fichier(s) · ${p.rows} ligne(s) lue(s) · ${p.addedContainers} fiche(s) contenant créée(s) · ${p.addedInterventions} intervention(s) rangée(s) dans leur fiche · ${p.recoveredContainerNumbers} numéro(s) retrouvé(s) sans ambiguïté dans un autre classeur · ${p.duplicates} doublon(s) ignoré(s) · ${p.errors} ligne(s) à vérifier. Données à enregistrer : ${(estimatedBytes/1048576).toFixed(1)} Mo.`;const items=[...p.issues.map(r=>({...r,kind:'À vérifier'})),...p.conflicts.map(r=>({...r,kind:'Type conservé'}))];$('#containerImportPreview').innerHTML=(p.reasons.length?`<p><b>Lignes ignorées par motif :</b> ${p.reasons.map(r=>`${r.count} · ${clean(r.reason)}`).join(' ; ')}</p>`:'')+(items.length?`<details open><summary>Détails affichés (${Math.min(items.length,40)} sur ${p.issueCount+p.conflictCount} lignes à vérifier)</summary><div class="owner-equipment-list"><table><thead><tr><th>Fichier / ligne</th><th>Contenant</th><th>Intervention</th><th>Analyse</th></tr></thead><tbody>${items.map(r=>`<tr><td>${clean(r.file)} · ${r.line}</td><td>${clean(r.number)||'—'}</td><td>${clean(r.intervention)||'—'}</td><td>${clean(r.kind)} · ${clean(r.reason)}</td></tr>`).join('')}</tbody></table></div></details>`:'<p>Aucune ligne à vérifier. Les doublons seront ignorés et aucune fiche existante ne sera remplacée.</p>');const ready=p.addedContainers+p.addedInterventions>0&&estimatedBytes<19*1048576;if(estimatedBytes>=19*1048576)$('#containerImportError').textContent='Le contenu complet dépasserait la limite actuelle de 20 Mo du serveur. Aucun élément n’a été enregistré. Contactez l’administrateur pour augmenter la capacité de stockage des contenants.';$('#containerImportConfirmRow').hidden=!ready;$('#containerImportApply').disabled=!ready||!canEdit();}catch(error){$('#containerImportError').textContent=error.message;$('#containerImportStatus').textContent='Analyse interrompue.';}};$('#containerImportConfirmed').onchange=()=>{$('#containerImportApply').disabled=!importPlan||!$('#containerImportConfirmed').checked||!canEdit()};$('#containerImportApply').onclick=async()=>{if(!importPlan||!$('#containerImportConfirmed').checked)return;if(importSnapshot!==JSON.stringify(state())){$('#containerImportError').textContent='Les contenants ont changé depuis l’analyse. Relancez l’aperçu avant de confirmer.';return;}const next=structuredClone(read());next.containers=importPlan.containers;$('#containerImportApply').disabled=true;$('#containerImportStatus').textContent='Enregistrement des fiches et interventions… Cela peut prendre jusqu’à 2 minutes.';if(await (saveContainers?saveContainers(next,{bulk:true}):save(next,false,{timeoutMs:120000,renderAfter:false}))){$('#containerImportDialog').close();list();}else{$('#containerImportStatus').textContent='Enregistrement non confirmé.';$('#containerImportError').textContent=$('#message').textContent||'Actualisez la page et vérifiez les contenants avant un nouvel essai.';importPlan=null;$('#containerImportConfirmed').checked=false;$('#containerImportConfirmRow').hidden=true;}};
 return {render:()=>{renderList();if(activeTab==='kpi')renderKpi()},list,open,validate:containerRecordsValid};
}
