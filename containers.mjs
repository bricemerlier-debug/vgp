import {buildContainerAgendaPdf} from './container-agenda-pdf.mjs';
const containerParts=['Relâche','Élastique','Pompe','Frein','Inter','Roues','Carter','Bâti','Visserie','Rivets','Poignée','Palier','Timon','Pignon','Chaîne','Sabot','Sangle','Tambour','Verrou','Protection ressort','Ressort','Coupelle','Bâche','Bavette','Manchon','Excentrique','Bague','Galet','Enroulement / déroulement','Pédale','Amortisseur','Verrouillage','Levier','Rétroviseur','Vérin'];
// Listes relevées des rapports CB001, CA267 et SE118 ; TC016 et CH81 n'en comportent pas.
const containerR2PliChecks=['Bâti','Galet','Butée','Flasque','Inter','Palier','Carter','Roue','Frein','Volant','Tambour','Enroulage','Rouleaux','Visserie'];
const containerPcChecks=['Bâti','Sangle','Flasque','Inter enroulage','Rouleaux','Carter','Sabot','Volant','Tambour','Palier','Prise chariot','Visserie'];
export function containerCategoryDefaultChecks(category){
 const key=String(category||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
 if(/(?:^| )(?:R2|PLT2)(?: |$)/.test(key)||key==='PLI'||key==='PLI AMIENS')return [...containerR2PliChecks];
 if(key==='PC'||key==='GDC'||key==='GDC PC')return [...containerPcChecks];
 return [];
}
const containerInterventionTypes=['préventif','curatif','sécurité'];
const containerNoPeriodTypes=new Set(['TR','TP','TJ','TG','SA','TF','TI','TK','TM','TN']);
export function containerHasNoPeriodicPreventive(container){
 const type=String(container?.type||'').trim().toLocaleUpperCase('fr');
 return containerNoPeriodTypes.has(type)||/^(TR|TP)/i.test(type)||/^(TR|TP)/i.test(String(container?.number||'').trim());
}
// Un réglage explicite de catégorie vaut validation du suivi, sans créer de contrôle ni d’échéance.
export function containerManuallyCompletedWithoutPeriod(container){
 return container?.categoryMonths===null;
}
export function containerCategorySettings(container){
 const noPeriod=containerHasNoPeriodicPreventive(container);
 const fallback=noPeriod?null:String(container.subtype||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes('carcasse')?18:12;
 const checks=container.categoryChecks;
 const legacyDefault=Array.isArray(checks)&&checks.length===containerParts.length&&checks.every((part,index)=>part===containerParts[index]);
 return {months:noPeriod?null:container.categoryMonths===undefined?fallback:container.categoryMonths,checks:checks===undefined||legacyDefault?containerCategoryDefaultChecks(container.subtype):checks};
}
export function containerCategorySettingsValid(container){
 return (container.categoryMonths===undefined||container.categoryMonths===null||Number.isInteger(container.categoryMonths)&&container.categoryMonths>=1&&container.categoryMonths<=120)
  &&(container.categoryChecks===undefined||Array.isArray(container.categoryChecks)&&container.categoryChecks.length<=100&&container.categoryChecks.every(check=>typeof check==='string'&&check.trim()===check&&check.length>0&&check.length<=100)&&new Set(container.categoryChecks.map(check=>check.toLocaleLowerCase('fr'))).size===container.categoryChecks.length);
}
const containerPhotoUuid='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
export function containerPhotoReferenceValid(container){
 const path=container.photoPath;
 return path===undefined||path===null||typeof path==='string'&&path.length<=256&&(
  new RegExp(`^local:${containerPhotoUuid}$`,'i').test(path)
  ||new RegExp(`^${containerPhotoUuid}/${containerPhotoUuid}_[a-f0-9]{64}\\.jpg$`,'i').test(path)
 );
}
async function prepareContainerPhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file?.type)||file.size>12*1024*1024)throw Error('Choisissez une photo JPEG, PNG ou WebP de 12 Mo maximum.');
 const bitmap=await createImageBitmap(file);
 try{
  if(bitmap.width*bitmap.height>40000000)throw Error('Photo trop grande : 40 mégapixels maximum.');
  const draw=(maxSide)=>{const scale=Math.min(1,maxSide/bitmap.width,maxSide/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);return canvas;};
  for(const [side,quality] of [[800,.76],[640,.66],[520,.56],[440,.46]]){
   const blob=await new Promise(resolve=>draw(side).toBlob(resolve,'image/jpeg',quality));
   if(blob&&blob.size<=180*1024)return blob;
  }
  throw Error('Photo encore trop volumineuse après compression (180 Ko maximum).');
 }finally{bitmap.close();}
}
async function containerPhotoDatabase(){
 return new Promise((resolve,reject)=>{const request=indexedDB.open('vgp-container-photos-v1',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('photos'))request.result.createObjectStore('photos',{keyPath:'path'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Stockage local des photos indisponible.'));});
}
async function containerPhotoStore(mode,operation){
 const db=await containerPhotoDatabase();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('photos',mode),request=operation(tx.objectStore('photos'));let result;request.onsuccess=()=>{result=request.result};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Modification locale de la photo annulée.'));});}finally{db.close();}
}
const storeContainerPhoto=(path,blob)=>containerPhotoStore('readwrite',store=>store.put({path,blob}));
async function readContainerPhoto(path){return (await containerPhotoStore('readonly',store=>store.get(path)))?.blob||null;}
const removeContainerPhoto=path=>containerPhotoStore('readwrite',store=>store.delete(path));
const escContainer=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const containerControllerKey=name=>String(name||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('fr');
const containerControllerIdentityKey=name=>String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[^\p{L}\p{N}]/gu,'');
const containerControllerMergedNames=new Map([
 ['fraindidier','CHRISTOPHE B.'],
 ['didierf','CHRISTOPHE B.'],
 ['berquer','CHRISTOPHE B.']
]);
const containerControllerExcludedNames=new Set(['c','sb053','sb080','se257']);
const containerControllerCanonicalName=name=>containerControllerMergedNames.get(containerControllerIdentityKey(name))||name;
const containerControllerNames=value=>String(value||'').split(/\s*(?:\/|[;,+&]|\bet\b)\s*/i).map(name=>name.trim()).filter(Boolean).flatMap(name=>/^autre$/i.test(name)?['Friedlander']:/^autre\b/i.test(name)?[]:[name]);
export function containerInterventionControllerValue(primary,secondary=''){
 const seen=new Set();
 return [primary,secondary].map(value=>String(value||'').trim()).filter(name=>{const key=containerControllerIdentityKey(name);if(!key||seen.has(key))return false;seen.add(key);return true;}).join(' / ');
}
const containerControllerDisplayName=value=>{
 const name=String(value||'').trim().replace(/\s+/g,' ');
 const initial=name.match(/^(.+?)(?:\s*\.|\s+)\s*([\p{L}])\.?$/u);
 return initial?`${initial[1].trim()} ${initial[2].toLocaleUpperCase('fr')}.`:name;
};
const containerControllerNameQuality=name=>(/\s/.test(name)?2:0)+(/\s[\p{L}]\.$/u.test(name)?3:0)-(/[\p{L}]\.[\p{L}]/u.test(name)?4:0);
export function containerControllerProfilesValid(profiles){
 if(profiles===undefined)return true;
 return Array.isArray(profiles)&&profiles.every(p=>p&&typeof p.id==='string'&&p.id&&typeof p.name==='string'&&p.name.trim()&&p.name.length<=160&&typeof p.email==='string'&&p.email.length<=254&&(!p.email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)))&&new Set(profiles.map(p=>p.id)).size===profiles.length&&new Set(profiles.map(p=>containerControllerKey(p.name))).size===profiles.length;
}
export function containerControllerRoster(document){
 const rows=new Map();
 const ensureRow=(sourceName,profile=null)=>{
  const name=containerControllerDisplayName(sourceName),key=containerControllerIdentityKey(name);
  if(!key||containerControllerExcludedNames.has(key))return null;
  let row=rows.get(key);
  if(!row){row={id:profile?.id||null,name,email:'',actions:[],last:'',_nameCounts:new Map(),_profileNames:new Set()};rows.set(key,row);}
  if(profile){row.id??=profile.id||null;row.email||=profile.email||'';row._profileNames.add(name);}
  row._nameCounts.set(name,(row._nameCounts.get(name)||0)+1);
  return row;
 };
 for(const profile of document.containerControllerProfiles||[])for(const name of containerControllerNames(profile.name)){
  const canonical=containerControllerCanonicalName(name);
  ensureRow(canonical,canonical===name?profile:null);
 }
 for(const container of document.containers||[])for(const intervention of container.interventions||[]){
  const seen=new Set();
  for(const original of containerControllerNames(intervention.controller)){
   const name=containerControllerCanonicalName(original);
   const key=containerControllerIdentityKey(name);if(seen.has(key))continue;seen.add(key);
   const row=ensureRow(name);if(!row)continue;
   row.actions.push({containerId:container.id,containerNumber:container.number,intervention});
   if(intervention.date>row.last)row.last=intervention.date;
  }
 }
 return [...rows.values()].map(row=>{
  row.name=[...row._nameCounts.keys()].sort((a,b)=>Number(row._profileNames.has(b))-Number(row._profileNames.has(a))||(row._nameCounts.get(b)-row._nameCounts.get(a))||containerControllerNameQuality(b)-containerControllerNameQuality(a)||a.localeCompare(b,'fr'))[0];
  delete row._nameCounts;delete row._profileNames;return row;
 }).sort((a,b)=>b.actions.length-a.actions.length||a.name.localeCompare(b.name,'fr'));
}
export function nextContainerInterventionNumber(containers=[]){
 const used=new Set(),numbers=[];
 for(const container of containers)for(const intervention of container.interventions||[]){
  const number=String(intervention.number??'').trim();
  if(number)used.add(number.toLocaleLowerCase('fr'));
  if(/^\d+$/.test(number))numbers.push(BigInt(number));
 }
 let candidate=(numbers.length?numbers.reduce((largest,value)=>value>largest?value:largest,0n):0n)+1n;
 while(used.has(candidate.toString().toLocaleLowerCase('fr')))candidate++;
 return candidate.toString();
}
export function containerCategories(containers,today=containerCivilToday()){
 const groups=new Map();
 for(const container of containers){
  const name=String(container.subtype||'').trim()||'Non renseigné',key=name.toLocaleLowerCase('fr');
  if(!groups.has(key))groups.set(key,{key,name,containers:[],interventions:0,active:0,archived:0,current:0,overdue:0,unknown:0,exempt:0});
  const group=groups.get(key),status=containerPreventiveStatus(container,today).status;
  group.containers.push(container);group.interventions+=(container.interventions||[]).length;
  if(status==='archived')group.archived++;else{group.active++;group[status==='soon'?'current':status]++;if(status==='exempt'&&containerManuallyCompletedWithoutPeriod(container))group.current++;}
 }
 return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr',{numeric:true}));
}
export function containerInterventionReport(container,intervention){
 const date=String(intervention.date||'').split('-').reverse().join('/');
 const components=Object.entries(intervention.parts||{}).filter(([,value])=>value).map(([part,value])=>`${part} : ${value}`);
 return {kind:'container',reportId:String(intervention.number),date,equipment:{designation:`Contenant ${container.number}`},fields:[['N° du contenant',container.number],['Catégorie',container.subtype],['Sous-catégorie',container.type],['N° d’intervention',intervention.number]],verifier:intervention.controller||'Non renseigné',result:intervention.type||'Non renseigné',generalState:intervention.generalState||'Non renseigné',observations:[intervention.comment||'Aucun commentaire renseigné.',...(components.length?['','État des composants',...components]:[])].join('\n'),conclusion:'Ce rapport reprend les informations enregistrées pour cette intervention sur le contenant.',signature:null};
}
export function containerLegacyScrapPlan(containers,{today=containerCivilToday(),by='',at=new Date().toISOString()}={}){
 const targets=[];
 const next=containers.map(container=>{
  if(containerArchiveInfo(container))return container;
  const latest=(container.interventions||[]).map(i=>String(i.date||'')).filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)).sort().at(-1);
  if(!latest||latest>='2024-07-01')return container;
  targets.push({id:container.id,number:container.number,last:latest});
  return {...container,manualArchive:{date:today,comment:`Dernière intervention le ${latest.split('-').reverse().join('/')} : antérieure au 01/07/2024.`,by,at,source:'last-intervention-before-2024-07-01'}};
 });
 return {containers:next,targets};
}
export function containerManualArchiveValid(archive){
 return archive===undefined||!!archive&&typeof archive==='object'&&!Array.isArray(archive)&&typeof archive.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(archive.date)&&Number.isFinite(Date.parse(archive.date+'T00:00:00Z'))&&new Date(archive.date+'T00:00:00Z').toISOString().slice(0,10)===archive.date&&typeof archive.comment==='string'&&archive.comment.length<=5000&&typeof archive.by==='string'&&archive.by.length<=254&&typeof archive.at==='string'&&Number.isFinite(Date.parse(archive.at));
}
export function containerArchiveInfo(container){
 const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
 const events=[];
 if(container.manualArchive&&containerManualArchiveValid(container.manualArchive))events.push({...container.manualArchive,manual:true,number:'',reason:'Mise au rebut manuelle',comment:container.manualArchive.comment||'Mise au rebut manuelle'});
 for(const [index,intervention] of (container.interventions||[]).entries()){
  const comment=String(intervention.comment||'');
  const text=normalize(comment);
  const pattern=/\b(?:mis(?:e)? au rebu(?:t|s)|mis(?:e)? en benne|destruction)\b/g;
  for(const match of text.matchAll(pattern)){
   const before=text.slice(Math.max(0,match.index-40),match.index);
   const after=text.slice(match.index+match[0].length,match.index+match[0].length+25);
   if(/(?:\bpas|\bnon|\bsans|\baucun(?:e)?|\bannul\w*|\bprevu\w*|\bprevoir|\bpour)\s*(?:de|la|le|une|un|l)?\s*$/.test(before)||/^\s*(?:a prevoir|prevue?|annulee?)/.test(after))continue;
   events.push({date:intervention.date,number:intervention.number,reason:match[0],comment,index});
   break;
  }
 }
 const reactivated=container.inventoryReactivatedAt;
 const latest=events.filter(event=>!reactivated||event.manual||Number.isInteger(reactivated.interventionCount)&&event.index>=reactivated.interventionCount||!Number.isInteger(reactivated.interventionCount)&&event.date>reactivated.date).sort((a,b)=>b.date.localeCompare(a.date))[0];
 return latest?{...latest,laterInterventions:(container.interventions||[]).filter(i=>i.date>latest.date).length}:null;
}

export function containerPreventiveStatus(container, today=new Date()){
 const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const months=containerCategorySettings(container).months;
 const archived=containerArchiveInfo(container);
 if(archived)return {months,last:null,due:null,days:null,status:'archived',archived};
 if(months===null)return {months:null,last:null,due:null,days:null,status:'exempt'};
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
const containerCivilToday=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Paris'});
const containerShiftDate=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
export function containerWeeklyAgenda(containers,weekDate=containerCivilToday(),today=containerCivilToday()){
 const weekday=new Date(weekDate+'T00:00:00Z').getUTCDay()||7;
 const start=containerShiftDate(weekDate,1-weekday);
 const days=Array.from({length:7},(_,index)=>({date:containerShiftDate(start,index),entries:[]}));
 const byDate=new Map(days.map(day=>[day.date,day]));
 let overdue=0,unknown=0;
 for(const container of containers){
  const status=containerPreventiveStatus(container,today);
  if(['archived','exempt'].includes(status.status))continue;
  if(status.status==='overdue')overdue++;
  if(status.status==='unknown')unknown++;
  const dates=[...new Set((container.interventions||[]).filter(i=>String(i.type||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()==='preventif'&&/^\d{4}-\d{2}-\d{2}$/.test(i.date)).map(i=>i.date))].sort();
  for(let index=0;index<dates.length;index++){
   const [y,m,d]=dates[index].split('-').map(Number);
   const target=new Date(Date.UTC(y,m-1+status.months,1));
   target.setUTCDate(Math.min(d,new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate()));
   const due=target.toISOString().slice(0,10),completedAt=dates[index+1]||null;
   if(completedAt&&completedAt<due)continue;
   const day=byDate.get(due);if(!day)continue;
   const done=!!completedAt&&completedAt<=today;
   day.entries.push({containerId:container.id,number:container.number,subtype:container.subtype,due,last:dates[index],done,completedAt:done?completedAt:null});
  }
 }
 for(const day of days)day.entries.sort((a,b)=>Number(a.done)-Number(b.done)||a.number.localeCompare(b.number,'fr',{numeric:true}));
 const entries=days.flatMap(day=>day.entries),completed=entries.filter(entry=>entry.done).length;
 return {start,end:days[6].date,days,total:entries.length,completed,pending:entries.length-completed,overdue,unknown};
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
  if(interval===null)continue;
  const archivedAt=containerArchiveInfo(container)?.date;
  const dates=[...new Set(preventiveDates)].sort();
  for(let i=0;i<dates.length;i++){
   const [y,m,d]=dates[i].split('-').map(Number);
   const target=new Date(Date.UTC(y,m-1+interval,1));
   const lastDay=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
   target.setUTCDate(Math.min(d,lastDay));
   const due=target.toISOString().slice(0,10);
   if(dates[i+1]&&dates[i+1]<due)continue;
   if(archivedAt&&due>=archivedAt)continue;
   if(Number(due.slice(0,4))===year)months[Number(due.slice(5,7))-1].due++;
  }
 }
 return months;
}
export function containerRecordsValid(d){return containerControllerProfilesValid(d.containerControllerProfiles)&&(d.containers===undefined||Array.isArray(d.containers)&&d.containers.every(c=>c&&typeof c.id==='string'&&typeof c.number==='string'&&c.number.trim()&&typeof c.type==='string'&&typeof c.subtype==='string'&&containerManualArchiveValid(c.manualArchive)&&containerCategorySettingsValid(c)&&containerPhotoReferenceValid(c)&&Array.isArray(c.interventions)&&c.interventions.every(i=>i&&typeof i.number==='string'&&typeof i.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(i.date)&&typeof i.controller==='string'&&typeof i.type==='string'&&typeof i.generalState==='string'&&typeof i.comment==='string'&&i.parts&&typeof i.parts==='object'&&!Array.isArray(i.parts)&&Object.entries(i.parts).every(([k,v])=>typeof k==='string'&&k.trim()===k&&k.length>0&&k.length<=100&&typeof v==='string')))&&new Set(d.containers.map(c=>c.id)).size===d.containers.length&&new Set(d.containers.map(c=>c.number.trim().toLocaleLowerCase('fr'))).size===d.containers.length&&new Set(d.containers.flatMap(c=>c.interventions.map(i=>c.number.trim().toLocaleLowerCase('fr')+'\u0000'+i.number.trim().toLocaleLowerCase('fr')))).size===d.containers.reduce((n,c)=>n+c.interventions.length,0))}

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
 const groups=new Map(containerReportTypes.map(([type])=>[type,{type,actions:0}]));
 const details=[];
 for(const container of containers){
  const matches=(container.interventions||[]).filter(i=>String(i.date||'').slice(0,7)===period);
  if(!matches.length)continue;
  const group=groups.get(containerReportCategory(container.subtype));
  group.actions+=matches.length;
  for(const intervention of matches)details.push({containerId:container.id,containerNumber:container.number,containerType:container.subtype,intervention});
 }
 details.sort((a,b)=>b.intervention.date.localeCompare(a.intervention.date)||String(a.containerNumber).localeCompare(String(b.containerNumber),'fr',{numeric:true})||String(a.intervention.number).localeCompare(String(b.intervention.number),'fr',{numeric:true}));
 const values=[...groups.values()];
 return {year,month,total:details.length,interventions:details.length,groups:values,details};
}

export function containerAnnualReport(containers,year){
 const groups=new Map(containerReportTypes.map(([type])=>[type,{type,actions:0}]));
 const months=Array.from({length:12},(_,index)=>({month:index+1,actions:0}));
 for(const container of containers){
  const group=groups.get(containerReportCategory(container.subtype));
  for(const intervention of container.interventions||[]){
   const date=String(intervention.date||'');
   if(Number(date.slice(0,4))!==year)continue;
   const month=months[Number(date.slice(5,7))-1];
   if(!month)continue;
   group.actions++;month.actions++;
  }
 }
 return {year,total:months.reduce((sum,month)=>sum+month.actions,0),groups:[...groups.values()],months};
}

function containerIsoWeek(date){
 const d=new Date(`${date}T00:00:00Z`);
 if(Number.isNaN(d.getTime()))return null;
 d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
 const year=d.getUTCFullYear();
 return {year,week:Math.ceil(((d-new Date(Date.UTC(year,0,1)))/86400000+1)/7)};
}

export function containerInterventionAnalysis(containers,year){
 const byCategory=new Map(containerReportTypes.map(([type])=>[type,0]));
 const byType=new Map(),byPart=new Map(),byContainer=new Map(),byWeek=new Map();
 const months=Array(12).fill(0);
 let total=0;
 for(const container of containers){
  let containerCount=0;
  const category=containerReportCategory(container.subtype);
  for(const intervention of container.interventions||[]){
   const date=String(intervention.date||'');
   if(Number(date.slice(0,4))!==year)continue;
   const month=Number(date.slice(5,7));if(month<1||month>12)continue;
   total++;containerCount++;months[month-1]++;byCategory.set(category,byCategory.get(category)+1);
   const type=String(intervention.type||'').trim()||'Non renseigné';
   byType.set(type,(byType.get(type)||0)+1);
   for(const [part,value] of Object.entries(intervention.parts||{})){
    if(!String(value||'').trim()||String(value).trim().toLowerCase()==='ok')continue;
    byPart.set(part,(byPart.get(part)||0)+1);
   }
   const week=containerIsoWeek(date);
   if(week&&week.year===year){
    const key=week.week;
    if(!byWeek.has(key))byWeek.set(key,{week:key,total:0,groups:new Map()});
    const item=byWeek.get(key);item.total++;item.groups.set(category,(item.groups.get(category)||0)+1);
   }
  }
  if(containerCount)byContainer.set(container.id,{id:container.id,number:container.number,subtype:container.subtype,count:containerCount});
 }
 const rank=map=>[...map].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'fr'));
 return {year,total,uniqueContainers:byContainer.size,months,categories:rank(byCategory),types:rank(byType),parts:rank(byPart),recurrence:[...byContainer.values()].sort((a,b)=>b.count-a.count||a.number.localeCompare(b.number,'fr',{numeric:true})),weeks:[...byWeek.values()].sort((a,b)=>a.week-b.week).map(w=>({week:w.week,total:w.total,groups:Object.fromEntries(w.groups)}))};
}

export function containerStatusCounts(containers,today=new Date()){
 const counts={current:0,overdue:0,unknown:0,exempt:0};
 for(const container of containers){
  const status=containerPreventiveStatus(container,today).status;
  if(status==='archived')continue;
 if(status==='overdue')counts.overdue++;
  else if(status==='unknown')counts.unknown++;
  else if(status==='exempt'){counts.exempt++;if(containerManuallyCompletedWithoutPeriod(container))counts.current++;}
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
  return !selectedStatuses.size||selectedStatuses.has(status==='soon'?'current':status)||status==='exempt'&&containerManuallyCompletedWithoutPeriod(container)&&selectedStatuses.has('current');
 });
}

export function sortContainerList(containers, key='number', direction='asc'){
 const collator=new Intl.Collator('fr',{numeric:true,sensitivity:'base'});
 const lastDate=c=>(c.interventions||[]).reduce((latest,i)=>i.date>latest?i.date:latest,'');
 const value=c=>key==='subtype'?c.subtype||'':key==='type'?c.type||'':key==='status'?containerPreventiveStatus(c).status:key==='due'?containerPreventiveStatus(c).due||'':key==='last'?lastDate(c):key==='count'?(c.interventions||[]).length:c.number||'';
 return [...containers].sort((a,b)=>{
  const av=value(a),bv=value(b);
  if(av===''||bv==='')return av===''&&bv===''?collator.compare(a.number,b.number):av===''?1:-1;
  const comparison=key==='count'?av-bv:collator.compare(av,bv);
  return (direction==='desc'?-1:1)*comparison||collator.compare(a.number,b.number);
 });
}

export function installContainersUI({root,read,save,saveContainers,canEdit,id,cloud=null,analyzeFiles,analyzeCategoryFiles,actor=()=>'',makeReportPdf}){
 let categoryQuery='',selectedCategory=null,categorySortKey='number',categorySortDirection='asc',categoryImportPlan=null,categoryImportSnapshot=null,scrappingId=null,agendaWeek=containerCivilToday(),controllerQuery='',editingControllerName=null,selected=null,editingContainerId=null,query='',selectedTypes=new Set(),selectedStatuses=new Set(),typeOptionsKey='',archiveQuery='',returnTab='list',sortKey='number',sortDirection='asc',importPlan=null,importSnapshot=null,activeTab='list',kpiYear=new Date().getFullYear(),analysisYear=new Date().getFullYear(),reportMode='month',reportDate=new Date();
 reportDate.setDate(1);reportDate.setMonth(reportDate.getMonth()-1);
 let reportYear=reportDate.getFullYear(),reportMonth=reportDate.getMonth()+1;
 const $=s=>document.querySelector(s), clean=s=>escContainer(s), state=()=>read().containers||[];
 const dateFr=s=>new Date(s+'T00:00:00').toLocaleDateString('fr-FR');
 const dueLabel=c=>{const p=containerPreventiveStatus(c);return p.status==='archived'?`Mis au rebut · ${dateFr(p.archived.date)}`:p.status==='exempt'?'Sans périodicité préventive':p.due?`${dateFr(p.due)} · ${p.days<0?`${-p.days} j de retard`:p.days===0?'Aujourd’hui':`${p.days} j restants`}`:'À planifier · aucun préventif'};
 const dueClass=c=>`container-due container-due-${containerPreventiveStatus(c).status}`;
 const statusLabel=c=>containerPreventiveStatus(c).status==='exempt'&&containerManuallyCompletedWithoutPeriod(c)?'Fait · sans périodicité':({overdue:'En retard',soon:'À échéance',current:'À jour',unknown:'Sans préventif',exempt:'Sans périodicité',archived:'Mis au rebut'})[containerPreventiveStatus(c).status];
 function list(){selected=null;$('#containerListPane').hidden=false;$('#containerDetailPane').hidden=true;$('#containerAdd').hidden=false;$('#containerImportButton').hidden=false;renderList();}
 function switchTab(tab){
  if(tab==='analysis')tab='kpi';activeTab=tab;
  $('#containerListTab').setAttribute('aria-selected',tab==='list'||tab==='archive');
  $('#containerKpiTab').setAttribute('aria-selected',tab==='kpi');
  $('#containerAgendaTab').setAttribute('aria-selected',tab==='agenda');
  $('#containerReportTab').setAttribute('aria-selected',tab==='report');
  $('#containerControllersTab').setAttribute('aria-selected',tab==='controllers');
  $('#containerCategoriesTab').setAttribute('aria-selected',tab==='categories');
  $('#containerInventoryTab').setAttribute('aria-selected',tab==='inventory');
  $('#inventoryView').hidden=tab!=='inventory';
  $('#containerListPanel').hidden=tab!=='list';
  $('#containerKpiPanel').hidden=tab!=='kpi';
  $('#containerAgendaPanel').hidden=tab!=='agenda';
  $('#containerArchivePanel').hidden=tab!=='archive';
  $('#containerAnalysisPanel').hidden=tab!=='kpi';
  $('#containerReportPanel').hidden=tab!=='report';
  $('#containerControllersPanel').hidden=tab!=='controllers';
  $('#containerCategoriesPanel').hidden=tab!=='categories';
  if(tab==='list')list();else{$('#containerAdd').hidden=true;$('#containerImportButton').hidden=true;if(tab==='agenda')renderAgenda();else if(tab==='kpi'){renderKpi();renderAnalysis();}else if(tab==='categories')renderCategories();else if(tab==='controllers')renderControllers();else if(tab==='archive')renderArchive();else if(tab==='analysis')renderAnalysis();else if(tab==='inventory'){}else renderReport();}
 }
 $('#containerListTab').onclick=()=>switchTab('list');
 $('#containerKpiTab').onclick=()=>switchTab('kpi');
 $('#containerAgendaTab').onclick=()=>switchTab('agenda');
 $('#containerAgendaPrevious').onclick=()=>{agendaWeek=containerShiftDate(agendaWeek,-7);renderAgenda()};
 $('#containerAgendaNext').onclick=()=>{agendaWeek=containerShiftDate(agendaWeek,7);renderAgenda()};
 $('#containerAgendaCurrent').onclick=()=>{agendaWeek=containerCivilToday();renderAgenda()};
 $('#containerAgendaPdf').onclick=()=>{
  const button=$('#containerAgendaPdf');button.disabled=true;$('#containerAgendaExportStatus').textContent='';
  try{
   const today=containerCivilToday(),agenda=containerWeeklyAgenda(state(),agendaWeek,today);
   const bytes=buildContainerAgendaPdf(agenda,{today,logo:read().reportLogo||undefined});
   const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),link=document.createElement('a');
   link.href=url;link.download=`preventifs-contenants-${agenda.start}-au-${agenda.end}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
   $('#containerAgendaExportStatus').textContent=`PDF préparé : ${agenda.pending} contenant${agenda.pending===1?'':'s'} restant à contrôler.`;
  }catch(error){$('#containerAgendaExportStatus').textContent='Export PDF impossible : '+error.message;}
  finally{button.disabled=false;}
 };
 $('#containerControllersTab').onclick=()=>switchTab('controllers');
 $('#containerCategoriesTab').onclick=()=>switchTab('categories');
 $('#containerInventoryTab').onclick=()=>switchTab('inventory');
 $('#containerCategorySearch').oninput=e=>{categoryQuery=e.target.value;selectedCategory=null;renderCategories()};
 $('#containerCategoryImportButton').onclick=()=>{
  categoryImportPlan=null;categoryImportSnapshot=null;
  $('#containerCategoryImportFiles').value='';$('#containerCategoryImportStatus').textContent='';
  $('#containerCategoryImportPreview').innerHTML='';$('#containerCategoryImportError').textContent='';
  $('#containerCategoryImportConfirmed').checked=false;$('#containerCategoryImportConfirmRow').hidden=true;
  $('#containerCategoryImportApply').disabled=true;$('#containerCategoryImportDialog').showModal();
 };
 $('#containerCategoryImportFiles').onchange=async event=>{
  const files=[...event.target.files],status=$('#containerCategoryImportStatus'),error=$('#containerCategoryImportError');
  categoryImportPlan=null;categoryImportSnapshot=null;error.textContent='';
  $('#containerCategoryImportPreview').innerHTML='';$('#containerCategoryImportConfirmRow').hidden=true;
  $('#containerCategoryImportConfirmed').checked=false;$('#containerCategoryImportApply').disabled=true;
  if(!files.length){status.textContent='';return;}
  status.textContent='Analyse des catégories…';
  try{
   const snapshot=JSON.stringify(state()),plan=await analyzeCategoryFiles(files,state());
   if(snapshot!==JSON.stringify(state()))throw Error('Les contenants ont changé pendant l’analyse. Recommencez.');
   categoryImportPlan=plan;categoryImportSnapshot=snapshot;
   status.textContent=`${plan.lines} ligne(s) lue(s) · ${plan.changes.length} fiche(s) à modifier · ${plan.unchanged.length} déjà à jour · ${plan.issues.length} ligne(s) non appliquée(s).`;
   const preview=$('#containerCategoryImportPreview');
   preview.innerHTML=`<h3>Catégories et sous-catégories trouvées</h3>${plan.categories.length?`<p>${plan.categories.map(row=>`${clean(row.category)} → ${clean(row.subcategory)}`).join(' · ')}</p>`:'<p>Aucune modification à appliquer.</p>'}<div class="owner-equipment-list"><table><thead><tr><th>Équipement</th><th>Catégorie actuelle</th><th>Nouvelle catégorie</th><th>Nouvelle sous-catégorie</th></tr></thead><tbody>${plan.changes.slice(0,40).map(row=>`<tr><td>${clean(row.number)}</td><td>${clean(row.previousCategory)||'—'}</td><td>${clean(row.category)}</td><td>${clean(row.subcategory)}</td></tr>`).join('')}</tbody></table></div>${plan.changes.length>40?`<p>${plan.changes.length-40} autre(s) fiche(s) à modifier.</p>`:''}${plan.issues.length?`<details><summary>${plan.issues.length} ligne(s) ignorée(s) ou en conflit</summary><div class="owner-equipment-list"><table><thead><tr><th>Fichier / ligne</th><th>Équipement</th><th>Motif</th></tr></thead><tbody>${plan.issues.slice(0,40).map(row=>`<tr><td>${clean(row.file)||'—'} · ${clean(row.line)||'—'}</td><td>${clean(row.number)||'—'}</td><td>${clean(row.reason)}</td></tr>`).join('')}</tbody></table></div></details>`:''}`;
   $('#containerCategoryImportConfirmRow').hidden=!plan.changes.length;
  }catch(problem){status.textContent='Analyse interrompue.';error.textContent=problem.message||'Classeur illisible.';}
 };
 $('#containerCategoryImportConfirmed').onchange=()=>{$('#containerCategoryImportApply').disabled=!categoryImportPlan?.changes.length||!$('#containerCategoryImportConfirmed').checked||!canEdit()};
 $('#containerCategoryImportApply').onclick=async()=>{
  const button=$('#containerCategoryImportApply'),error=$('#containerCategoryImportError');
  if(!categoryImportPlan?.changes.length||!$('#containerCategoryImportConfirmed').checked||!canEdit())return;
  if(categoryImportSnapshot!==JSON.stringify(state())){error.textContent='Les contenants ont changé depuis l’aperçu. Relancez l’analyse.';return;}
  const next=structuredClone(read());next.containers=categoryImportPlan.containers;
  if(!containerRecordsValid(next)){error.textContent='Les données du classeur ne sont pas valides. Aucune fiche modifiée.';return;}
  button.disabled=true;$('#containerCategoryImportStatus').textContent='Enregistrement des catégories…';
  const ok=await(saveContainers?saveContainers(next,{bulk:true}):save(next,false,{timeoutMs:120000,renderAfter:false}));
  if(ok){const count=categoryImportPlan.changes.length;$('#containerCategoryImportDialog').close();selectedCategory=null;renderCategories();$('#message').textContent=`${count} fiche(s) mises à jour : catégories et sous-catégories importées. Interventions conservées.`;}
  else{error.textContent=$('#message').textContent||'Enregistrement non confirmé.';$('#containerCategoryImportStatus').textContent='Enregistrement interrompu.';button.disabled=false;}
 };
 $('#containerControllerSearch').oninput=e=>{controllerQuery=e.target.value;renderControllers()};
 $('#containerControllerAdd').onclick=()=>openControllerForm();
 $('#containerArchiveTab').onclick=()=>switchTab('archive');
 $('#containerArchiveSearch').oninput=e=>{archiveQuery=e.target.value;renderArchive()};
 $('#containerArchiveBack').onclick=()=>switchTab('list');
 $('#containerAnalysisYear').onchange=e=>{const year=Number(e.target.value);if(Number.isInteger(year)&&year>=1900&&year<=9999){analysisYear=year;renderAnalysis()}else e.target.value=analysisYear};
 $('#containerReportTab').onclick=()=>switchTab('report');
 $('#containerReportMonthly').onclick=()=>{reportMode='month';renderReport()};
 $('#containerReportAnnual').onclick=()=>{reportMode='year';renderReport()};
 $('#containerReportYear').onchange=e=>{const year=Number(e.target.value);if(Number.isInteger(year)&&year>=1900&&year<=9999){reportYear=year;renderReport()}else e.target.value=reportYear};
 $('#containerReportMonth').onchange=e=>{const [year,month]=e.target.value.split('-').map(Number);if(year>=2026&&month>=1&&month<=12&&e.target.value<=$('#containerReportMonth').max){reportYear=year;reportMonth=month;renderReport()}};
 $('#containerReportPrint').onclick=()=>window.print();
 $('#containerReportDownload').onclick=async()=>{
  const button=$('#containerReportDownload');button.disabled=true;
  try{
   const response=await fetch(reportMode==='year'?'assets/container-annual-report-template.pptx':'assets/container-report-template.pptx');
   if(!response.ok)throw new Error('Modèle PowerPoint introuvable.');
   const report=reportMode==='year'?containerAnnualReport(state(),reportYear):containerMonthlyReport(state(),reportYear,reportMonth);
   const month=new Intl.DateTimeFormat('fr-FR',{month:'long'}).format(new Date(reportYear,reportMonth-1,1));
   const bytes=globalThis.VGPFillContainerReportPptx(new Uint8Array(await response.arrayBuffer()),{month,year:reportYear,counts:report.groups.map(g=>g.actions),total:report.total});
   const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}));
   const link=document.createElement('a');link.href=url;link.download=reportMode==='year'?`bilan-contenants-${reportYear}-annuel.pptx`:`bilan-contenants-${reportYear}-${String(reportMonth).padStart(2,'0')}.pptx`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(error){alert(error.message||'Téléchargement impossible.')}finally{button.disabled=false}
 };
 $('#containerKpiYear').onchange=e=>{const year=Number(e.target.value);if(Number.isInteger(year)&&year>=1900&&year<=9999){kpiYear=year;analysisYear=year;renderKpi();renderAnalysis()}else e.target.value=kpiYear;};
 $('#containerKpiPreviousYear').onclick=()=>{if(kpiYear>1900){kpiYear--;analysisYear=kpiYear;renderKpi();renderAnalysis();}};
 $('#containerKpiNextYear').onclick=()=>{if(kpiYear<9999){kpiYear++;analysisYear=kpiYear;renderKpi();renderAnalysis();}};

 function populateCategories(subtypeValue=''){
  const sub=$('#containerSubtypeChoice'),previous=subtypeValue||sub.value;
  const subs=[...new Set(state().map(c=>c.subtype).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  sub.innerHTML='<option value="">Choisir une catégorie</option>'+subs.map(v=>`<option value="${clean(v)}">${clean(v)}</option>`).join('')+'<option value="__other__">Autre…</option>';
  sub.value=subs.includes(previous)?previous:previous==='__other__'?'__other__':'';
  $('#containerForm [name=subtypeOther]').hidden=sub.value!=='__other__';
  $('#containerForm [name=subtypeOther]').required=sub.value==='__other__';
 }
 function interventionHistoryHtml(container){
  if(!container.interventions.length)return '<p class="empty">Aucune intervention enregistrée sur ce contenant.</p>';
  return `<div class="owner-equipment-list container-intervention-history"><table><thead><tr><th>Date</th><th>Contenant</th><th>Type de contenant</th><th>N° intervention</th><th>Type d’intervention</th><th>Contrôleur</th><th>Commentaire</th><th>Rapport</th></tr></thead><tbody>${[...container.interventions].sort((a,b)=>b.date.localeCompare(a.date)).map(intervention=>`<tr><td>${dateFr(intervention.date)}</td><td><b>${clean(container.number)}</b></td><td>${clean(container.subtype)||'—'}</td><td>${clean(intervention.number)}</td><td>${clean(intervention.type)||'—'}</td><td>${clean(intervention.controller)||'—'}</td><td class="container-report-comment">${clean(intervention.comment)||'—'}${intervention.generalState?`<small>État général : ${clean(intervention.generalState)}</small>`:''}${Object.values(intervention.parts||{}).some(Boolean)?`<details><summary>État des composants</summary><dl class="container-parts">${Object.entries(intervention.parts||{}).filter(([,value])=>value).map(([part,value])=>`<div><dt>${clean(part)}</dt><dd>${clean(value)}</dd></div>`).join('')}</dl></details>`:''}</td><td><button type="button" class="secondary" data-container-pdf="${clean(intervention.number)}">Générer rapport PDF</button></td></tr>`).join('')}</tbody></table></div>`;
 }
 async function downloadInterventionPdf(container,number,button){
  const intervention=container.interventions.find(row=>row.number===number);if(!intervention||button.disabled)return;
  button.disabled=true;
  try{
   const bytes=await makeReportPdf(containerInterventionReport(container,intervention));
   const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),link=document.createElement('a');
   link.href=url;link.download=`rapport-contenant-${container.number}-${intervention.number}.pdf`.replace(/[^a-zA-Z0-9._-]/g,'_');link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(error){$('#message').textContent='Rapport PDF indisponible : '+error.message;}finally{button.disabled=false;}
 }
 function renderCategories(){
  const groups=containerCategories(state()),query=categoryQuery.trim().toLocaleLowerCase('fr'),group=groups.find(row=>row.key===selectedCategory);
  const host=$('#containerCategoriesContent');
  if(group){
   const subcategories=[...new Set(group.containers.map(container=>container.type?.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
   host.innerHTML=`<div class="toolbar"><h3>${clean(group.name)}</h3><button type="button" class="secondary" id="containerCategoryBack">← Toutes les catégories</button></div><p>${group.active} en suivi · ${group.archived} archivé${group.archived===1?'':'s'} · ${group.interventions} intervention${group.interventions===1?'':'s'}</p><p>Sous-catégories : ${subcategories.map(clean).join(' · ')||'Non renseignées'}</p><form id="containerCategoryForm" class="container-category-form"><div class="fields"><label>Périodicité préventive<input name="months" type="number" min="0" max="120" step="1" required><small>0 = aucune périodicité</small></label><label class="wide">Contrôles à effectuer sur ce type de contenant<textarea name="checks" rows="7" maxlength="10000" placeholder="Un contrôle par ligne"></textarea></label></div><p class="foot">Un contrôle par ligne. La liste apparaît lors d’une nouvelle intervention. Les interventions enregistrées restent intactes.</p>${group.containers.some(containerHasNoPeriodicPreventive)?'<p class="foot">Les sous-catégories TR, TP, TJ, TG, SA, TF, TI, TK, TM et TN n’ont pas de périodicité de contrôle, quelle que soit celle de leur catégorie.</p>':''}<p id="containerCategoryError" class="error" role="alert"></p><button type="submit">Enregistrer la catégorie</button></form><div class="owner-equipment-list"><table><thead><tr>${[['number','Contenant'],['type','Sous-catégorie'],['status','Statut'],['due','Prochain préventif'],['count','Interventions']].map(([key,label])=>`<th scope="col" aria-sort="${categorySortKey===key?categorySortDirection==='asc'?'ascending':'descending':'none'}"><button type="button" class="container-sort" data-category-sort="${key}" aria-label="Trier par ${label}, ${categorySortKey===key&&categorySortDirection==='asc'?'ordre décroissant':'ordre croissant'}">${label}<span aria-hidden="true">${categorySortKey===key?categorySortDirection==='asc'?' ↑':' ↓':' ↕'}</span></button></th>`).join('')}<th scope="col">Fiche</th></tr></thead><tbody>${sortContainerList(group.containers,categorySortKey,categorySortDirection).map(container=>`<tr class="container-row-${containerPreventiveStatus(container).status}"><td><b>${clean(container.number)}</b></td><td>${clean(container.type)||'—'}</td><td><span class="container-status-pill ${dueClass(container)}">${statusLabel(container)}</span></td><td>${dueLabel(container)}</td><td>${container.interventions.length}</td><td><button type="button" class="secondary" data-category-container-open="${clean(container.id)}">Ouvrir</button></td></tr>`).join('')}</tbody></table></div>`;
   host.querySelectorAll('[data-category-sort]').forEach(button=>button.onclick=()=>{const key=button.dataset.categorySort;categorySortDirection=categorySortKey===key?(categorySortDirection==='asc'?'desc':'asc'):(key==='count'||key==='due'?'desc':'asc');categorySortKey=key;renderCategories();host.querySelector(`[data-category-sort="${key}"]`)?.focus()});
   const settings=containerCategorySettings(group.containers.find(container=>!containerHasNoPeriodicPreventive(container))||group.containers[0]),form=$('#containerCategoryForm');
   form.elements.months.value=settings.months===null?'0':String(settings.months);
   form.elements.checks.value=settings.checks.join('\n');
   form.querySelector('button[type=submit]').disabled=!canEdit();
   form.onsubmit=async event=>{
    event.preventDefault();if(!canEdit())return;
    const months=form.elements.months.value==='0'?null:Number(form.elements.months.value);
    const checks=form.elements.checks.value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
    const sample={categoryMonths:months,categoryChecks:checks},error=$('#containerCategoryError');error.textContent='';
    if(!containerCategorySettingsValid(sample)){error.textContent='Choisissez une périodicité de 1 à 120 mois, et au plus 100 contrôles distincts de 100 caractères.';return;}
    const next=structuredClone(read());let changed=0;
    for(const container of next.containers||[])if(container.subtype.trim().toLocaleLowerCase('fr')===group.key){container.categoryMonths=months;container.categoryChecks=[...checks];changed++;}
    const button=form.querySelector('button[type=submit]');button.disabled=true;
    const ok=await (saveContainers?saveContainers(next):save(next,false,{timeoutMs:120000,renderAfter:false}));
    if(ok){renderCategories();$('#message').textContent=`Catégorie « ${group.name} » enregistrée pour ${changed} contenant${changed===1?'':'s'}.`;}
    else{error.textContent=$('#message').textContent||'Enregistrement impossible.';button.disabled=false;}
   };
   $('#containerCategoryBack').onclick=()=>{selectedCategory=null;renderCategories()};
   host.querySelectorAll('[data-category-container-open]').forEach(button=>button.onclick=()=>{switchTab('list');open(button.dataset.categoryContainerOpen,'categories')});
   return;
  }
  const filtered=groups.filter(group=>group.name.toLocaleLowerCase('fr').includes(query));
  host.innerHTML=filtered.length?`<div class="container-category-cards">${filtered.map(group=>`<article class="container-controller-card"><h3>${clean(group.name)}</h3><p><strong>${group.active}</strong> contenant${group.active===1?'':'s'} en suivi</p><p>Sous-catégories : ${[...new Set(group.containers.map(container=>container.type?.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr')).map(clean).join(' · ')||'Non renseignées'}</p><p>${group.interventions} intervention${group.interventions===1?'':'s'} · ${group.archived} archivé${group.archived===1?'':'s'}</p><p class="foot">${group.current} à jour · ${group.overdue} en retard · ${group.unknown} sans préventif${group.exempt?` · ${group.exempt} sans périodicité`:''}</p><button type="button" class="secondary" data-container-category="${clean(group.key)}">Ouvrir la fiche</button></article>`).join('')}</div>`:'<p class="empty">Aucune catégorie de contenant.</p>';
  host.querySelectorAll('[data-container-category]').forEach(button=>button.onclick=()=>{selectedCategory=button.dataset.containerCategory;renderCategories()});
 }
 function renderAgenda(){
  const current=containerCivilToday(),agenda=containerWeeklyAgenda(state(),agendaWeek,current);
  $('#containerAgendaExportStatus').textContent='';
  $('#containerAgendaRange').textContent=`Du ${dateFr(agenda.start)} au ${dateFr(agenda.end)}`;
  $('#containerAgendaSummary').innerHTML=`<strong>${agenda.pending} à faire</strong><span>${agenda.completed} fait${agenda.completed===1?'':'s'} · ${agenda.total} échéance${agenda.total===1?'':'s'} dans la semaine</span>`;
  $('#containerAgendaDays').innerHTML=agenda.days.map(day=>`<section class="calendar-day ${day.date===current?'calendar-today':''}"><h3>${new Date(day.date+'T00:00:00Z').toLocaleDateString('fr-FR',{weekday:'short',timeZone:'UTC'})}<span>${dateFr(day.date).slice(0,5)}</span></h3>${day.entries.length?day.entries.map(entry=>`<button type="button" class="calendar-task ${entry.done?'calendar-done':day.date<current?'calendar-late':'calendar-pending'}" data-container-agenda-open="${clean(entry.containerId)}"><b>${clean(entry.number)}</b><small>${clean(entry.subtype)||'Type non renseigné'}</small><span>${entry.done?`Fait le ${dateFr(entry.completedAt)}`:day.date<current?'En retard':'À faire'}</span></button>`).join(''):'<p class="calendar-empty">Aucun préventif prévu</p>'}</section>`).join('');
  $('#containerAgendaDays').querySelectorAll('[data-container-agenda-open]').forEach(button=>button.onclick=()=>{switchTab('list');open(button.dataset.containerAgendaOpen,'agenda')});
  $('#containerAgendaOverdue').textContent=`${agenda.overdue} contenant${agenda.overdue===1?'':'s'} en retard à ce jour`;
  $('#containerAgendaOverdue').disabled=agenda.overdue===0;
  $('#containerAgendaUnknown').textContent=`${agenda.unknown} sans préventif enregistré`;
  $('#containerAgendaUnknown').disabled=agenda.unknown===0;
 }
 function showAgendaScope(status){
  query='';selectedTypes.clear();selectedStatuses=new Set([status]);$('#containerSearch').value='';
  $('#containerTypeFilters').querySelectorAll('input').forEach(input=>input.checked=false);
  $('#containerStatusFilters').querySelectorAll('input').forEach(input=>input.checked=input.value===status);
  switchTab('list');
 }
 $('#containerAgendaOverdue').onclick=()=>showAgendaScope('overdue');
 $('#containerAgendaUnknown').onclick=()=>showAgendaScope('unknown');
 function renderControllers(){
  const roster=containerControllerRoster(read());
  const query=containerControllerKey(controllerQuery);
  const profiles=roster.filter(profile=>containerControllerKey(`${profile.name} ${profile.email}`).includes(query));
  $('#containerControllerAdd').disabled=!canEdit();
  $('#containerControllerHistory').hidden=true;
  $('#containerControllerCards').innerHTML=profiles.length?profiles.map(profile=>`<article class="container-controller-card"><h3>${clean(profile.name)}</h3><p>${profile.email?`<a href="mailto:${clean(profile.email)}">${clean(profile.email)}</a>`:'<span class="foot">E-mail non renseigné</span>'}</p><p><strong>${profile.actions.length}</strong> intervention${profile.actions.length===1?'':'s'}</p><small>Dernière intervention : ${profile.last?dateFr(profile.last):'Aucune'}</small><div class="actions"><button type="button" class="secondary" data-container-controller-history="${clean(profile.name)}">Ouvrir la fiche</button><button type="button" class="secondary" data-container-controller-edit="${clean(profile.name)}" ${canEdit()?'':'disabled'}>Coordonnées</button></div></article>`).join(''):'<p class="empty">'+(roster.length?'Aucun contrôleur ne correspond à la recherche.':'Aucun contrôleur de contenants enregistré.')+'</p>';
  $('#containerControllerCards').querySelectorAll('[data-container-controller-edit]').forEach(button=>button.onclick=()=>openControllerForm(button.dataset.containerControllerEdit));
  $('#containerControllerCards').querySelectorAll('[data-container-controller-history]').forEach(button=>button.onclick=()=>{
   const profile=roster.find(row=>row.name===button.dataset.containerControllerHistory);if(!profile)return;
   $('#containerControllerHistoryTitle').textContent=`${profile.name} · ${profile.actions.length} intervention${profile.actions.length===1?'':'s'}`;
   $('#containerControllerHistoryEmail').innerHTML=profile.email?`Adresse e-mail : <a href="mailto:${clean(profile.email)}">${clean(profile.email)}</a>`:'Adresse e-mail non renseignée';
   $('#containerControllerHistoryRows').innerHTML=profile.actions.length?`<div class="owner-equipment-list"><table><thead><tr><th>Date</th><th>Contenant</th><th>N° intervention</th><th>Type</th><th>Commentaire</th><th>Fiche</th></tr></thead><tbody>${[...profile.actions].sort((a,b)=>b.intervention.date.localeCompare(a.intervention.date)).map(({containerId,containerNumber,intervention})=>`<tr><td>${dateFr(intervention.date)}</td><td><b>${clean(containerNumber)}</b></td><td>${clean(intervention.number)}</td><td>${clean(intervention.type)||'—'}</td><td class="container-report-comment">${clean(intervention.comment)||'—'}</td><td><button type="button" class="secondary" data-controller-container-open="${clean(containerId)}">Ouvrir</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">Aucune intervention enregistrée pour cette fiche.</p>';
   $('#containerControllerHistory').hidden=false;
   $('#containerControllerHistoryRows').querySelectorAll('[data-controller-container-open]').forEach(openButton=>openButton.onclick=()=>{switchTab('list');open(openButton.dataset.controllerContainerOpen,'controllers')});
   $('#containerControllerHistory').scrollIntoView({block:'start',behavior:'smooth'});
  });
  $('#containerControllerHistoryBack').onclick=()=>{$('#containerControllerHistory').hidden=true;$('#containerControllerCards').scrollIntoView({block:'start',behavior:'smooth'});};
 }
 function openControllerForm(name=null){
  if(!canEdit())return;
  const profile=name&&containerControllerRoster(read()).find(row=>row.name===name);
  const form=$('#containerControllerForm');form.reset();editingControllerName=profile?.name||null;
  form.elements.name.value=profile?.name||'';form.elements.name.readOnly=!!profile;form.elements.email.value=profile?.email||'';
  $('#containerControllerFormTitle').textContent=profile?`Coordonnées · ${profile.name}`:'Ajouter un contrôleur de contenants';
  $('#containerControllerFormError').textContent='';$('#containerControllerFormStatus').textContent='';$('#containerControllerDialog').showModal();
 }
 $('#containerControllerForm').onsubmit=async event=>{
  event.preventDefault();if(!canEdit())return;
  const form=event.currentTarget,button=$('#containerControllerSubmit');if(button.disabled)return;
  const name=(editingControllerName||form.elements.name.value).trim().replace(/\s+/g,' '),email=form.elements.email.value.trim();
  if(!name)return;
  if(!editingControllerName&&containerControllerRoster(read()).some(profile=>containerControllerIdentityKey(profile.name)===containerControllerIdentityKey(name))){$('#containerControllerFormError').textContent='Ce contrôleur de contenants existe déjà.';return;}
  const next=structuredClone(read());next.containerControllerProfiles??=[];
  const profile=next.containerControllerProfiles.find(row=>containerControllerIdentityKey(row.name)===containerControllerIdentityKey(name));
  if(profile)profile.email=email;else next.containerControllerProfiles.push({id:id(),name,email});
  if(!containerControllerProfilesValid(next.containerControllerProfiles)){$('#containerControllerFormError').textContent='Vérifiez le nom et l’adresse e-mail.';return;}
  button.disabled=true;$('#containerControllerFormStatus').textContent='Enregistrement en cours…';
  try{
   if(await save(next,false,{timeoutMs:120000,renderAfter:false})){$('#containerControllerDialog').close();renderControllers();}
   else $('#containerControllerFormError').textContent=$('#message').textContent||'Enregistrement impossible.';
  }finally{button.disabled=false;$('#containerControllerFormStatus').textContent='';}
 };
 function renderAnalysis(){
  const analysis=containerInterventionAnalysis(state(),analysisYear);
  $('#containerAnalysisYear').value=analysisYear;
  $('#containerAnalysisSummary').innerHTML=`<div><strong>${analysis.total}</strong><span>interventions</span></div><div><strong>${analysis.uniqueContainers}</strong><span>contenants distincts</span></div><div><strong>${analysis.total?Math.round(analysis.total/analysis.uniqueContainers*10)/10:0}</strong><span>interventions par contenant</span></div>`;
  const typeColors=['#0057a8','#ed8b25','#16816d','#8468b3','#c34c59','#65758a'];
  let typeAngle=0;
  const typeSlices=analysis.types.map((item,index)=>{const start=typeAngle;typeAngle+=item.count/analysis.total*100;return `${typeColors[index%typeColors.length]} ${start}% ${typeAngle}%`});
  $('#containerAnalysisTypes').innerHTML=analysis.total?`<div class="container-type-chart"><div class="container-type-pie" role="img" aria-label="Répartition des ${analysis.total} interventions par type" style="background:conic-gradient(${typeSlices.join(',')})"></div><ul class="container-type-legend">${analysis.types.map((item,index)=>`<li><i style="background:${typeColors[index%typeColors.length]}"></i><span>${clean(item.label)}</span><strong>${item.count}</strong><small>${(item.count/analysis.total*100).toLocaleString('fr-FR',{maximumFractionDigits:2})} %</small></li>`).join('')}</ul></div>`:'<p class="empty">Aucune intervention pour cette année.</p>';
  const populatedCategories=analysis.categories.filter(item=>item.count);
  const categoryMax=Math.max(1,...populatedCategories.map(item=>item.count));
  $('#containerAnalysisCategories').innerHTML=populatedCategories.length?`<div class="container-category-bars">${populatedCategories.map((item,index)=>`<div class="container-category-row"><div class="container-category-label"><span>${clean(item.label)}</span><strong>${item.count} <small>· ${(item.count/analysis.total*100).toLocaleString('fr-FR',{maximumFractionDigits:1})} %</small></strong></div><div class="container-category-track" role="img" aria-label="${clean(item.label)} : ${item.count} interventions"><span style="width:${item.count/categoryMax*100}%;background:var(--container-type-${containerReportTypes.findIndex(([label])=>label===item.label)})"></span></div></div>`).join('')}</div>`:'<p class="empty">Aucune intervention pour cette année.</p>';
  const recurringRow=(item,index)=>`<div class="container-recurrence-row"><span class="container-recurrence-rank">${index+1}</span><div><b>${clean(item.number)}</b><small>${clean(item.subtype)||'Type non renseigné'}</small></div><strong>${item.count}</strong><button type="button" class="secondary" data-container-analysis-open="${clean(item.id)}">Ouvrir</button></div>`;
  $('#containerAnalysisRecurrence').innerHTML=analysis.recurrence.length?`<div class="container-recurrence-list">${analysis.recurrence.slice(0,5).map(recurringRow).join('')}${analysis.recurrence.length>5?`<details><summary>Voir les autres contenants</summary>${analysis.recurrence.slice(5,20).map((item,index)=>recurringRow(item,index+5)).join('')}</details>`:''}</div>`:'<p class="empty">Aucune intervention pour cette année.</p>';
  $('#containerAnalysisRecurrence').querySelectorAll('[data-container-analysis-open]').forEach(button=>button.onclick=()=>{switchTab('list');open(button.dataset.containerAnalysisOpen,'analysis')});
  const categories=containerReportTypes.map(([type])=>type);
  const chart=$('#containerAnalysisChart'),detail=$('#containerAnalysisWeekDetail');
  const max=Math.max(1,...analysis.weeks.map(week=>week.total));
  const peak=Math.ceil(max/20)*20;
  chart.innerHTML=analysis.weeks.length?`<div class="container-week-plot" style="--week-plot-height:220px;min-width:${Math.max(760,analysis.weeks.length*43)}px"><div class="container-week-grid" aria-hidden="true">${[4,3,2,1,0].map(n=>`<span>${Math.round(peak*n/4)}</span>`).join('')}</div><div class="container-week-bars">${analysis.weeks.map((week,index)=>`<button type="button" class="container-week-bar" data-container-week="${index}" aria-label="Semaine ${week.week} : ${week.total} interventions" style="--week-height:${Math.max(2,week.total/peak*100)}%"><span class="container-week-stack">${categories.map((type,i)=>week.groups[type]?`<span class="container-week-segment" style="--week-color:var(--container-type-${i});flex:${week.groups[type]}" title="${clean(type)} : ${week.groups[type]}" data-count="${week.groups[type]}"></span>`:'').join('')}</span><span class="container-week-number">${String(week.week).padStart(2,'0')}</span></button>`).join('')}</div></div>`:'<p class="empty">Aucune intervention pour cette année.</p>';
  $('#containerAnalysisLegend').innerHTML=categories.map((type,i)=>`<span><i style="background:var(--container-type-${i})"></i>${clean(type)}</span>`).join('');
  const showWeek=index=>{
   const week=analysis.weeks[index];if(!week){detail.textContent='Aucune intervention pour cette année.';return}
   chart.querySelectorAll('.container-week-bar').forEach((button,i)=>button.classList.toggle('is-active',i===index));
   detail.innerHTML=`<strong>Semaine ${String(week.week).padStart(2,'0')} · ${week.total} intervention${week.total===1?'':'s'}</strong><div>${categories.map((type,i)=>week.groups[type]?`<span><i style="background:var(--container-type-${i})"></i>${clean(type)} <b>${week.groups[type]}</b></span>`:'').join('')}</div>`;
  };
  chart.querySelectorAll('.container-week-bar').forEach(button=>{button.onmouseenter=()=>showWeek(Number(button.dataset.containerWeek));button.onfocus=()=>showWeek(Number(button.dataset.containerWeek));button.onclick=()=>showWeek(Number(button.dataset.containerWeek))});
  showWeek(analysis.weeks.length-1);
  $('#containerAnalysisWeeks').innerHTML=analysis.weeks.length?`<table><thead><tr><th>Semaine</th>${categories.map(type=>`<th>${clean(type)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${analysis.weeks.map(week=>`<tr><th scope="row">${analysisYear}/${String(week.week).padStart(2,'0')}</th>${categories.map(type=>`<td>${week.groups[type]||'—'}</td>`).join('')}<td><b>${week.total}</b></td></tr>`).join('')}</tbody></table>`:'<p class="empty">Aucune intervention pour cette année.</p>';
 }
 function renderReport(){
  const period=`${reportYear}-${String(reportMonth).padStart(2,'0')}`;
  const latest=new Date();latest.setDate(1);latest.setMonth(latest.getMonth()-1);
  $('#containerReportMonth').max=`${latest.getFullYear()}-${String(latest.getMonth()+1).padStart(2,'0')}`;
  $('#containerReportMonth').value=period;
  $('#containerReportYear').value=reportYear;
  $('#containerReportMonthly').setAttribute('aria-pressed',String(reportMode==='month'));
  $('#containerReportAnnual').setAttribute('aria-pressed',String(reportMode==='year'));
  $('#containerReportMonthly').classList.toggle('secondary',reportMode!=='month');
  $('#containerReportAnnual').classList.toggle('secondary',reportMode!=='year');
  $('#containerReportMonthLabel').hidden=reportMode!=='month';
  $('#containerReportYearLabel').hidden=reportMode!=='year';
  $('#containerReportHeading').textContent=reportMode==='year'?'Rapport annuel des contenants':'Rapport mensuel des contenants';
  const monthName=new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(new Date(reportYear,reportMonth-1,1));
  const report=reportMode==='year'?containerAnnualReport(state(),reportYear):containerMonthlyReport(state(),reportYear,reportMonth);
  $('#containerReportPeriod').textContent=reportMode==='year'?`Bilan année ${reportYear}`:`Bilan mois de ${monthName.split(' ')[0].toLocaleUpperCase('fr')}`;
  $('#containerReportInterventions').textContent=`${report.total} intervention${report.total===1?'':'s'} enregistrée${report.total===1?'':'s'} sur ${reportMode==='year'?'l’année':'le mois'}.`;
  $('#containerReportRows').innerHTML=report.groups.map((group,index)=>`<tr><th scope="row">${clean(group.type)}</th><td>${group.actions}</td>${index===0?`<td id="containerReportTotalCell" rowspan="${report.groups.length}">${report.total}</td>`:''}</tr>`).join('');
  $('#containerReportAnnualMonths').hidden=reportMode!=='year';
  $('#containerReportDetailsTitle').parentElement.hidden=reportMode==='year';
  if(reportMode==='year'){
   const names=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
   $('#containerReportAnnualRows').innerHTML=`<div class="owner-equipment-list"><table><thead><tr><th>Mois</th><th>Interventions</th><th>Détail</th></tr></thead><tbody>${report.months.map(({month,actions})=>`<tr><td>${names[month-1]}</td><td>${actions}</td><td><button type="button" class="secondary" data-container-annual-month="${month}" ${actions?'':'disabled'}>Voir les interventions</button></td></tr>`).join('')}</tbody></table></div>`;
   $('#containerReportAnnualRows').querySelectorAll('[data-container-annual-month]').forEach(button=>button.onclick=()=>{reportMonth=Number(button.dataset.containerAnnualMonth);reportMode='month';renderReport();$('#containerReportDetailsTitle').scrollIntoView({block:'start',behavior:'smooth'})});
   return;
  }
  $('#containerReportDetailsTitle').textContent=`Interventions de ${monthName} · ${report.details.length}`;
  $('#containerReportDetailsRows').innerHTML=report.details.length?`<div class="owner-equipment-list"><table><thead><tr><th scope="col">Date</th><th scope="col">Contenant</th><th scope="col">Type de contenant</th><th scope="col">N° d’intervention</th><th scope="col">Type d’intervention</th><th scope="col">Contrôleur</th><th scope="col">Commentaire</th><th scope="col">Fiche</th></tr></thead><tbody>${report.details.map(({containerId,containerNumber,containerType,intervention})=>`<tr><td>${dateFr(intervention.date)}</td><td><b>${clean(containerNumber)}</b></td><td>${clean(containerType)||'—'}</td><td>${clean(intervention.number)}</td><td>${clean(intervention.type)||'—'}</td><td>${clean(intervention.controller)||'—'}</td><td class="container-report-comment">${clean(intervention.comment)||'—'}</td><td><button type="button" class="secondary" data-container-report-open="${clean(containerId)}">Ouvrir</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">Aucune intervention enregistrée pour ce mois.</p>';
  $('#containerReportDetailsRows').querySelectorAll('[data-container-report-open]').forEach(button=>button.onclick=()=>{switchTab('list');open(button.dataset.containerReportOpen,'report')});
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
 function renderArchive(){
  const archived=state().filter(c=>containerArchiveInfo(c));
  const q=archiveQuery.trim().toLocaleLowerCase('fr');
  const rows=sortContainerList(archived.filter(c=>`${c.number} ${c.subtype}`.toLocaleLowerCase('fr').includes(q)));
  $('#containerArchiveTab').textContent=`Archivés (${archived.length})`;
  $('#containerArchiveCount').textContent=`${rows.length} contenant${rows.length===1?'':'s'} affiché${rows.length===1?'':'s'} sur ${archived.length} archivé${archived.length===1?'':'s'}`;
  $('#containerArchiveRows').innerHTML=rows.length?`<div class="owner-equipment-list"><table><thead><tr><th>N° d’équipement</th><th>Type de contenant</th><th>Date du rebut</th><th>Commentaire source</th><th></th></tr></thead><tbody>${rows.map(c=>{const a=containerArchiveInfo(c);return `<tr class="container-row-archived"><td><b>${clean(c.number)}</b></td><td>${clean(c.subtype)||'—'}</td><td>${dateFr(a.date)}</td><td><b>${clean(a.reason)}</b><small>${clean(a.comment)}</small>${a.laterInterventions?`<span class="container-archive-warning">${a.laterInterventions} intervention${a.laterInterventions===1?'':'s'} après le rebut · à vérifier</span>`:''}</td><td><button type="button" class="secondary" data-container-archive-open="${clean(c.id)}">Ouvrir</button></td></tr>`}).join('')}</tbody></table></div>`:'<p class="empty">'+(archived.length?'Aucun contenant archivé ne correspond à la recherche.':'Aucun contenant archivé.')+'</p>';
  $('#containerArchiveRows').querySelectorAll('[data-container-archive-open]').forEach(button=>button.onclick=()=>{switchTab('list');open(button.dataset.containerArchiveOpen,'archive')});
 }
 function renderList(){
  const all=state().filter(c=>!containerArchiveInfo(c));
  const archiveCount=state().length-all.length;
  $('#containerArchiveTab').textContent=`Archivés (${archiveCount})`;
  populateCategories();renderTypeFilters(all);
  const matching=filterContainerList(all,{query,types:[...selectedTypes]});
  const filtered=filterContainerList(matching,{statuses:[...selectedStatuses]});
  const rows=sortContainerList(filtered,sortKey,sortDirection);
  $('#containerCount').textContent=`${filtered.length} contenant${filtered.length===1?'':'s'} affiché${filtered.length===1?'':'s'} sur ${all.length} · ${filtered.reduce((n,c)=>n+c.interventions.length,0)} intervention${filtered.reduce((n,c)=>n+c.interventions.length,0)===1?'':'s'}`;
  const counts=containerStatusCounts(matching);
  $('#containerListPane').querySelectorAll('[data-container-summary-status]').forEach(button=>button.setAttribute('aria-pressed',String(selectedStatuses.has(button.dataset.containerSummaryStatus))));
  $('#containerCurrentCount').textContent=counts.current;
  $('#containerOverdueCount').textContent=counts.overdue;
  $('#containerUnknownCount').textContent=counts.unknown;
  $('#containerExemptCount').textContent=counts.exempt;
 $('#containerRows').innerHTML=rows.length?`<div class="owner-equipment-list"><table><thead><tr>${[['number','N° d’équipement'],['subtype','Catégorie'],['due','Prochain préventif'],['last','Dernière intervention'],['count','Interventions']].map(([key,label])=>`<th scope="col" aria-sort="${sortKey===key?sortDirection==='asc'?'ascending':'descending':'none'}"><button type="button" class="container-sort" data-container-sort="${key}" aria-label="Trier par ${label}, ${sortKey===key&&sortDirection==='asc'?'ordre décroissant':'ordre croissant'}">${label}<span aria-hidden="true">${sortKey===key?sortDirection==='asc'?' ↑':' ↓':' ↕'}</span></button></th>`).join('')}<th scope="col"><span class="sr-only">Action</span></th></tr></thead><tbody>${rows.map(c=>{const last=[...c.interventions].sort((a,b)=>b.date.localeCompare(a.date))[0];return `<tr class="container-row-${containerPreventiveStatus(c).status}"><td><b>${clean(c.number)}</b></td><td>${clean(c.subtype)||'—'}<small>Sous-catégorie : ${clean(c.type)||'—'}</small></td><td><span class="container-status-pill ${dueClass(c)}">${statusLabel(c)}</span><small>${dueLabel(c)}</small></td><td>${last?new Date(last.date+'T00:00:00').toLocaleDateString('fr-FR'):'Aucune'}</td><td>${c.interventions.length}</td><td><button class="secondary" data-container-open="${clean(c.id)}">Ouvrir</button></td></tr>`}).join('')}</tbody></table></div>`:'<p class="empty">'+(all.length?'Aucun contenant ne correspond à la recherche.':'Aucun contenant enregistré. Vous pourrez créer les fiches manuellement ou les importer ultérieurement.')+'</p>';$('#containerRows').querySelectorAll('[data-container-sort]').forEach(b=>b.onclick=()=>{const key=b.dataset.containerSort;sortDirection=sortKey===key?(sortDirection==='asc'?'desc':'asc'):(key==='count'||key==='last'?'desc':'asc');sortKey=key;renderList();$('#containerRows').querySelector(`[data-container-sort=\"${key}\"]`)?.focus()});$('#containerRows').querySelectorAll('[data-container-open]').forEach(b=>b.onclick=()=>open(b.dataset.containerOpen));$('#containerAdd').disabled=!canEdit();$('#containerImportButton').disabled=!canEdit();}
 let containerPhotoObjectUrl=null,containerPhotoBusy=false;
 function revokeContainerPhotoUrl(){if(containerPhotoObjectUrl){URL.revokeObjectURL(containerPhotoObjectUrl);containerPhotoObjectUrl=null;}}
 function open(idValue,origin='list'){
  const c=state().find(x=>x.id===idValue);if(!c)return;
  revokeContainerPhotoUrl();selected=c.id;returnTab=origin;
  $('#containerListPane').hidden=true;$('#containerDetailPane').hidden=false;$('#containerAdd').hidden=true;$('#containerImportButton').hidden=true;
  const last=[...c.interventions].sort((a,b)=>b.date.localeCompare(a.date))[0],archive=containerArchiveInfo(c);
  $('#containerDetail').innerHTML=`<div class="container-detail-summary"><div class="container-detail-main"><div class="toolbar"><div><p class="eyebrow">FICHE CONTENANT</p><h2>${clean(c.number)}</h2></div><div class="container-detail-actions"><button type="button" class="secondary" id="containerEdit">Modifier la fiche</button>${!archive?'<button type="button" class="danger" id="containerScrap">Mettre au rebut</button>':''}<button type="button" class="secondary" id="containerBack">← ${origin==='archive'?'Archives':origin==='report'?'Rapport mensuel':origin==='analysis'?'Analyse interventions':origin==='controllers'?'Contrôleurs des contenants':origin==='agenda'?'Agenda':origin==='categories'?'Catégorie':origin==='inventory'?'Inventaire':'Tous les contenants'}</button></div></div>
  <dl class="container-facts"><div><dt>Catégorie</dt><dd>${clean(c.subtype)||'Non renseignée'}</dd></div><div><dt>Sous-catégorie</dt><dd>${clean(c.type)||'Non renseignée'}</dd></div><div><dt>${archive?'Statut':containerPreventiveStatus(c).months===null?'Préventif':`Prochain préventif · tous les ${containerPreventiveStatus(c).months} mois`}</dt><dd class="${dueClass(c)}">${dueLabel(c)}</dd></div><div><dt>Dernière intervention</dt><dd>${last?new Date(last.date+'T00:00:00').toLocaleDateString('fr-FR'):'Aucune intervention'}</dd></div><div><dt>Nombre d’interventions</dt><dd>${c.interventions.length}</dd></div></dl></div>
  <section class="container-photo-card" aria-label="Photo du contenant"><div class="container-photo-frame"><img id="containerPhotoImage" alt="Photo du contenant ${clean(c.number)}" hidden><div id="containerPhotoPlaceholder"><span aria-hidden="true">＋</span><small>Photo du contenant</small></div></div><input type="file" id="containerPhotoInput" accept="image/jpeg,image/png,image/webp" hidden><div class="container-photo-actions"><button type="button" class="secondary" id="containerPhotoPick">${c.photoPath?'Remplacer la photo':'Ajouter une photo'}</button><button type="button" class="secondary" id="containerPhotoRemove" ${c.photoPath?'':'hidden'}>Retirer</button></div><p class="foot" id="containerPhotoStatus" role="status"></p><p class="error" id="containerPhotoError" role="alert"></p></section></div>
  ${c.inventoryHistory?.length?`<aside class="container-inventory-note">${c.inventoryHistory.map(note=>`<p><b>${clean(note.comment)}</b> · ${clean(note.by)}</p>`).join('')}</aside>`:''}${archive?`<aside class="container-archive-note"><b>Mis au rebut le ${dateFr(archive.date)}</b> · ${archive.manual?`Décision manuelle · ${clean(archive.by)}`:`Intervention ${clean(archive.number)}`}<p>${clean(archive.comment)}</p>${archive.laterInterventions?`<p class="container-archive-warning">${archive.laterInterventions} intervention${archive.laterInterventions===1?'':'s'} enregistrée${archive.laterInterventions===1?'':'s'} après le rebut · situation à vérifier.</p>`:''}</aside>`:''}<div class="toolbar"><h3>Historique des interventions</h3><button type="button" id="containerAddIntervention">+ Ajouter une intervention</button></div>${interventionHistoryHtml(c)}`;
  $('#containerBack').onclick=()=>returnTab==='archive'?switchTab('archive'):returnTab==='report'?switchTab('report'):returnTab==='analysis'?switchTab('analysis'):returnTab==='controllers'?switchTab('controllers'):returnTab==='agenda'?switchTab('agenda'):returnTab==='categories'?switchTab('categories'):returnTab==='inventory'?switchTab('inventory'):list();
  $('#containerEdit').disabled=!canEdit();$('#containerEdit').onclick=()=>openEdit(c);
  if($('#containerScrap')){$('#containerScrap').disabled=!canEdit();$('#containerScrap').onclick=()=>openScrap(c);}
  $('#containerAddIntervention').disabled=!canEdit();$('#containerAddIntervention').onclick=()=>openIntervention(c);
  $('#containerDetail').querySelectorAll('[data-container-pdf]').forEach(button=>button.onclick=()=>downloadInterventionPdf(c,button.dataset.containerPdf,button));
  const photoInput=$('#containerPhotoInput'),photoPick=$('#containerPhotoPick'),photoRemove=$('#containerPhotoRemove'),photoImage=$('#containerPhotoImage'),photoPlaceholder=$('#containerPhotoPlaceholder'),photoStatus=$('#containerPhotoStatus'),photoError=$('#containerPhotoError');
  photoPick.disabled=!canEdit()||containerPhotoBusy;photoRemove.disabled=!canEdit()||containerPhotoBusy;
  photoPick.onclick=()=>photoInput.click();
  photoInput.onchange=async()=>{
   const file=photoInput.files?.[0];if(!file)return;photoInput.value='';containerPhotoBusy=true;photoError.textContent='';photoPick.disabled=photoRemove.disabled=true;photoStatus.textContent='Préparation de la photo…';
   let nextPath=null;
   try{
    const blob=await prepareContainerPhoto(file);photoStatus.textContent='Envoi de la photo optimisée…';
    nextPath=cloud?await cloud.maintenanceUpload(blob,c.id):`local:${crypto.randomUUID()}`;
    if(!cloud)await storeContainerPhoto(nextPath,blob);
    const next=structuredClone(read()),target=(next.containers||[]).find(row=>row.id===c.id);
    if(!target)throw Error('Cette fiche est introuvable. Actualisez la page.');
    const oldPath=target.photoPath;target.photoPath=nextPath;
    const saved=await (saveContainers?saveContainers(next):save(next,false,{timeoutMs:120000,renderAfter:false}));
    if(!saved){if(!cloud)await removeContainerPhoto(nextPath);throw Error($('#message').textContent||'La photo n’a pas été enregistrée.');}
    let cleanupWarning='';
    if(oldPath&&oldPath!==nextPath){try{if(oldPath.startsWith('local:'))await removeContainerPhoto(oldPath);else if(cloud)await cloud.removeContainerPhoto(oldPath);}catch(error){cleanupWarning=` La nouvelle photo est enregistrée, mais l’ancienne copie n’a pas pu être supprimée : ${error.message}`;}}
    open(c.id,origin);$('#containerPhotoStatus').textContent='Photo enregistrée.'+cleanupWarning;
   }catch(error){photoError.textContent=error.message+(cloud?' Vérifiez que supabase/017_container_photos.sql est installé.':'');photoStatus.textContent='La fiche n’a pas été modifiée.';}
   finally{containerPhotoBusy=false;if($('#containerPhotoPick'))$('#containerPhotoPick').disabled=!canEdit();if($('#containerPhotoRemove'))$('#containerPhotoRemove').disabled=!canEdit();}
  };
  photoRemove.onclick=async()=>{
   if(containerPhotoBusy||!c.photoPath||!canEdit())return;containerPhotoBusy=true;photoError.textContent='';photoPick.disabled=photoRemove.disabled=true;photoStatus.textContent='Suppression de la photo…';
   try{const next=structuredClone(read()),target=(next.containers||[]).find(row=>row.id===c.id);if(!target)throw Error('Cette fiche est introuvable. Actualisez la page.');const oldPath=target.photoPath;delete target.photoPath;const saved=await (saveContainers?saveContainers(next):save(next,false,{timeoutMs:120000,renderAfter:false}));if(!saved)throw Error($('#message').textContent||'La photo n’a pas été retirée de la fiche.');let cleanupWarning='';try{if(oldPath.startsWith('local:'))await removeContainerPhoto(oldPath);else if(cloud)await cloud.removeContainerPhoto(oldPath);}catch(error){cleanupWarning=` La référence est retirée, mais la copie de stockage n’a pas pu être supprimée : ${error.message}`;}open(c.id,origin);$('#containerPhotoStatus').textContent='Photo retirée.'+cleanupWarning;}
   catch(error){photoError.textContent=error.message+(cloud?' Vérifiez que supabase/017_container_photos.sql est installé.':'');photoStatus.textContent='La fiche n’a pas été modifiée.';}
   finally{containerPhotoBusy=false;if($('#containerPhotoPick'))$('#containerPhotoPick').disabled=!canEdit();if($('#containerPhotoRemove'))$('#containerPhotoRemove').disabled=!canEdit();}
  };
  if(c.photoPath){photoStatus.textContent='Chargement de la photo…';(async()=>{try{let url;if(c.photoPath.startsWith('local:')){const blob=await readContainerPhoto(c.photoPath);if(!blob)throw Error('Photo locale introuvable.');containerPhotoObjectUrl=URL.createObjectURL(blob);url=containerPhotoObjectUrl;}else if(cloud)url=await cloud.maintenancePhotoUrl(c.photoPath);else throw Error('Cette photo privée est disponible après connexion.');if(!photoImage.isConnected)return;photoImage.src=url;photoImage.hidden=false;photoPlaceholder.hidden=true;photoStatus.textContent='Photo du contenant.';}catch(error){if(photoStatus.isConnected)photoStatus.textContent='Photo indisponible : '+error.message;}})();}
 }
 function openScrap(container){
  if(!canEdit()||containerArchiveInfo(container))return;
  scrappingId=container.id;
  const form=$('#containerScrapForm');form.reset();form.elements.date.value=containerCivilToday();form.elements.date.max=containerCivilToday();
  $('#containerScrapTitle').textContent=`Mettre ${container.number} au rebut`;
  $('#containerScrapError').textContent='';$('#containerScrapStatus').textContent='';$('#containerScrapDialog').showModal();
 }
 $('#containerScrapForm').onsubmit=async event=>{
  event.preventDefault();if(!canEdit())return;
  const form=event.currentTarget,button=$('#containerScrapSubmit');if(button.disabled)return;
  const next=structuredClone(read()),container=(next.containers||[]).find(row=>row.id===scrappingId);
  $('#containerScrapError').textContent='';
  if(!container||containerArchiveInfo(container)){$('#containerScrapError').textContent='Ce contenant est introuvable ou déjà archivé. Actualisez la page.';return;}
  const archive={date:form.elements.date.value,comment:form.elements.comment.value.trim(),by:String(actor()),at:new Date().toISOString()};
  if(!containerManualArchiveValid(archive)||archive.date>containerCivilToday()){$('#containerScrapError').textContent='Vérifiez la date de mise au rebut.';return;}
  container.manualArchive=archive;button.disabled=true;$('#containerScrapStatus').textContent='Mise au rebut en cours…';
  try{
   const ok=await (saveContainers?saveContainers(next):save(next,false,{timeoutMs:120000,renderAfter:false}));
   if(ok){$('#containerScrapDialog').close();switchTab('list');open(container.id,'archive');}
   else $('#containerScrapError').textContent=$('#message').textContent||'Mise au rebut non enregistrée. Actualisez avant de réessayer.';
  }finally{button.disabled=false;$('#containerScrapStatus').textContent='';}
 };
 function openEdit(c){
  if(!canEdit())return;
  editingContainerId=c.id;
  const form=$('#containerForm');form.reset();
  form.elements.number.value=c.number;form.elements.type.value=c.type;
  populateCategories(c.subtype);
  $('#containerFormTitle').textContent=`Modifier le contenant · ${c.number}`;
  $('#containerFormSubmit').textContent='Enregistrer les modifications';
  $('#containerFormError').textContent='';$('#containerFormStatus').textContent='';
  $('#containerDialog').showModal();
 }
 function renderContainerChecklist(container){
  const host=$('#containerPartFields'),checks=containerCategorySettings(container).checks;
  $('#containerChecklistHelp').textContent=checks.length?`Catégorie ${container.subtype||'non renseignée'} · Les points sont tous cochés au départ.`:'';
  host.replaceChildren();
  if(!checks.length){
   const message=document.createElement('p');message.className='foot';
   message.textContent='Aucune checklist définie pour cette catégorie. Ajoutez-la dans l’onglet Catégories.';
   host.append(message);return;
  }
  for(const part of checks){
   const row=document.createElement('div');row.className='container-part-row';
   const label=document.createElement('label');label.className='container-part-check';
   const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.name='partIncluded:'+part;checkbox.checked=true;
   label.append(checkbox,document.createTextNode(part));
   const status=document.createElement('select');status.name='part:'+part;status.setAttribute('data-native-select','');status.setAttribute('aria-label','État de '+part);
   for(const value of ['Vérifié','OK','À réparer','À remplacer','Sans objet']){
    const option=document.createElement('option');option.value=value;option.textContent=value;status.append(option);
   }
   checkbox.onchange=()=>{status.disabled=!checkbox.checked;row.classList.toggle('container-part-skipped',!checkbox.checked);};
   row.append(label,status);host.append(row);
  }
 }
 function openIntervention(c){const form=$('#containerInterventionForm'),roster=containerControllerRoster(read()).map(profile=>`<option value="${clean(profile.name)}">${clean(profile.name)}</option>`).join('');form.reset();form.elements.controller.innerHTML='<option value="">Choisir un contrôleur</option>'+roster;form.elements.controller2.innerHTML='<option value="">Aucun deuxième contrôleur</option>'+roster;form.elements.date.value=new Date().toISOString().slice(0,10);$('#containerInterventionTitle').textContent=`Nouvelle intervention · ${c.number}`;renderContainerChecklist(c);$('#containerInterventionChecklist').hidden=true;$('#containerInterventionError').textContent='';$('#containerInterventionStatus').textContent='';$('#containerInterventionDialog').showModal();}
 $('#containerInterventionForm').querySelectorAll('[name=type]').forEach(input=>input.onchange=()=>{$('#containerInterventionChecklist').hidden=formType()!=='préventif'});
 function formType(){return $('#containerInterventionForm [name=type]:checked')?.value||'';}
 $('#containerTypeFilters').onchange=e=>{if(e.target.type!=='checkbox')return;e.target.checked?selectedTypes.add(e.target.value):selectedTypes.delete(e.target.value);renderList()};
 $('#containerStatusFilters').onchange=e=>{if(e.target.type!=='checkbox')return;e.target.checked?selectedStatuses.add(e.target.value):selectedStatuses.delete(e.target.value);renderList()};
 $('#containerListPane').querySelectorAll('[data-container-summary-status]').forEach(button=>button.onclick=()=>{const status=button.dataset.containerSummaryStatus;selectedStatuses.has(status)?selectedStatuses.delete(status):selectedStatuses.add(status);$('#containerStatusFilters').querySelectorAll('input').forEach(input=>input.checked=selectedStatuses.has(input.value));renderList()});
 $('#containerClearFilters').onclick=()=>{query='';selectedTypes.clear();selectedStatuses.clear();$('#containerSearch').value='';$('#containerTypeFilters').querySelectorAll('input').forEach(input=>input.checked=false);$('#containerStatusFilters').querySelectorAll('input').forEach(input=>input.checked=false);renderList()};
 $('#containerSearch').oninput=e=>{query=e.target.value;renderList()};$('#containerAdd').onclick=()=>{const f=$('#containerForm');f.reset();populateCategories();editingContainerId=null;$('#containerFormTitle').textContent='Créer une fiche contenant';$('#containerFormSubmit').textContent='Créer la fiche';$('#containerFormError').textContent='';$('#containerFormStatus').textContent='';$('#containerDialog').showModal()};$('#containerSubtypeChoice').onchange=e=>{const other=e.target.value==='__other__';$('#containerForm [name=subtypeOther]').hidden=!other;$('#containerForm [name=subtypeOther]').required=other;};
 $('#containerForm').onsubmit=async e=>{
  e.preventDefault();if(!canEdit())return;
  const form=e.currentTarget,button=$('#containerFormSubmit'),values=new FormData(form);
  const number=String(values.get('number')).replace(/\*/g,'').trim(),currentId=editingContainerId;
  $('#containerFormError').textContent='';
  if(state().some(c=>c.id!==currentId&&c.number.replace(/\*/g,'').trim().toLocaleLowerCase('fr')===number.toLocaleLowerCase('fr'))){$('#containerFormError').textContent='Ce numéro de contenant existe déjà.';return;}
  const type=String(values.get('type')||'').trim();
  const subtype=String(values.get('subtype'))==='__other__'?String(values.get('subtypeOther')).trim():String(values.get('subtype')).trim();
  if(!number||!type||!subtype){$('#containerFormError').textContent='Renseignez le numéro, la catégorie et la sous-catégorie du contenant.';return;}
  const next=structuredClone(read());next.containers??=[];
  const existing=currentId&&next.containers.find(c=>c.id===currentId);
  if(currentId&&!existing){$('#containerFormError').textContent='Cette fiche est introuvable. Actualisez la page.';return;}
  const savedId=existing?.id||id();
  const previousSubtype=existing?.subtype;
  if(existing)Object.assign(existing,{number,type,subtype});
  else next.containers.push({id:savedId,number,type,subtype,interventions:[]});
  const sameCategory=next.containers.find(c=>c.id!==savedId&&c.subtype.trim().toLocaleLowerCase('fr')===subtype.toLocaleLowerCase('fr'));
  const target=next.containers.find(c=>c.id===savedId);
  if(sameCategory&&(previousSubtype!==subtype||target.categoryMonths===undefined||target.categoryChecks===undefined)){const settings=containerCategorySettings(sameCategory);target.categoryMonths=settings.months;target.categoryChecks=[...settings.checks];}
  else if(previousSubtype!==undefined&&previousSubtype!==subtype){delete target.categoryMonths;delete target.categoryChecks;}
  button.disabled=true;$('#containerFormStatus').textContent='Enregistrement en cours…';
  const ok=await (saveContainers?saveContainers(next):save(next,false,{timeoutMs:120000,renderAfter:false}));
  button.disabled=false;$('#containerFormStatus').textContent='';
  if(ok){$('#containerDialog').close();renderList();open(savedId,returnTab);}
  else $('#containerFormError').textContent=$('#message').textContent||'Enregistrement impossible. Actualisez la page avant de réessayer.';
 };
 $('#containerInterventionForm').onsubmit=async e=>{
  e.preventDefault();if(!canEdit())return;
  const form=e.currentTarget,button=$('#containerInterventionSubmit'),values=new FormData(form);
  const current=state().find(c=>c.id===selected),type=String(values.get('type')||'').trim(),controller1=String(values.get('controller')||'').trim(),controller2=String(values.get('controller2')||'').trim();
  $('#containerInterventionError').textContent='';
  if(!current){$('#containerInterventionError').textContent='Cette fiche est introuvable. Actualisez la page.';return;}
  if(!controller1){$('#containerInterventionError').textContent='Choisissez le contrôleur 1 pour enregistrer cette intervention.';return;}
  if(!containerInterventionTypes.includes(type)){$('#containerInterventionError').textContent='Choisissez Préventif, Curatif ou Sécurité.';return;}
  const controllerRoster=containerControllerRoster(read());
  if(!controllerRoster.some(profile=>profile.name===controller1)||controller2&&!controllerRoster.some(profile=>profile.name===controller2)){$('#containerInterventionError').textContent='Choisissez les contrôleurs dans la liste.';return;}
  const controller=containerInterventionControllerValue(controller1,controller2);
  const parts=type==='préventif'?Object.fromEntries(containerCategorySettings(current).checks.filter(p=>values.has('partIncluded:'+p)).map(p=>[p,String(values.get('part:'+p)||'Vérifié')])):{};
  const next=structuredClone(read()),container=next.containers.find(c=>c.id===selected);
  if(!container){$('#containerInterventionError').textContent='Cette fiche est introuvable. Actualisez la page.';return;}
  const number=nextContainerInterventionNumber(next.containers||[]);
  container.interventions.push({number,date:String(values.get('date')),controller,type,generalState:'',comment:String(values.get('comment')).trim(),parts});
  button.disabled=true;$('#containerInterventionStatus').textContent='Enregistrement en cours…';
  const ok=await (saveContainers?saveContainers(next):save(next,false,{timeoutMs:120000,renderAfter:false}));
  button.disabled=false;$('#containerInterventionStatus').textContent='';
  if(ok){$('#containerInterventionDialog').close();open(container.id,returnTab);}
  else $('#containerInterventionError').textContent=$('#message').textContent||'Enregistrement impossible. Actualisez la page avant de réessayer.';
 };
 $('#containerImportButton').onclick=()=>{importPlan=null;importSnapshot=null;$('#containerImportFiles').value='';$('#containerImportStatus').textContent='';$('#containerImportPreview').innerHTML='';$('#containerImportError').textContent='';$('#containerImportConfirmed').checked=false;$('#containerImportConfirmRow').hidden=true;$('#containerImportApply').disabled=true;$('#containerImportDialog').showModal()};$('#containerImportFiles').onchange=async e=>{importPlan=null;$('#containerImportApply').disabled=true;$('#containerImportConfirmRow').hidden=true;$('#containerImportPreview').innerHTML='';$('#containerImportError').textContent='';const files=[...e.target.files];if(!files.length)return;$('#containerImportStatus').textContent=`Analyse locale de ${files.length} classeur(s)…`;try{importSnapshot=JSON.stringify(state());importPlan=await analyzeFiles(files,state());const p=importPlan;const estimatedBytes=new TextEncoder().encode(JSON.stringify({...read(),containers:p.containers})).length;p.estimatedBytes=estimatedBytes;$('#containerImportStatus').textContent=`${p.files.length} fichier(s) · ${p.rows} ligne(s) lue(s) · ${p.addedContainers} fiche(s) contenant créée(s) · ${p.addedInterventions} intervention(s) rangée(s) dans leur fiche · ${p.recoveredContainerNumbers} numéro(s) retrouvé(s) sans ambiguïté dans un autre classeur · ${p.duplicates} doublon(s) ignoré(s) · ${p.errors} ligne(s) à vérifier. Données à enregistrer : ${(estimatedBytes/1048576).toFixed(1)} Mo.`;const items=[...p.issues.map(r=>({...r,kind:'À vérifier'})),...p.conflicts.map(r=>({...r,kind:'Type conservé'}))];$('#containerImportPreview').innerHTML=(p.reasons.length?`<p><b>Lignes ignorées par motif :</b> ${p.reasons.map(r=>`${r.count} · ${clean(r.reason)}`).join(' ; ')}</p>`:'')+(items.length?`<details open><summary>Détails affichés (${Math.min(items.length,40)} sur ${p.issueCount+p.conflictCount} lignes à vérifier)</summary><div class="owner-equipment-list"><table><thead><tr><th>Fichier / ligne</th><th>Contenant</th><th>Intervention</th><th>Analyse</th></tr></thead><tbody>${items.map(r=>`<tr><td>${clean(r.file)} · ${r.line}</td><td>${clean(r.number)||'—'}</td><td>${clean(r.intervention)||'—'}</td><td>${clean(r.kind)} · ${clean(r.reason)}</td></tr>`).join('')}</tbody></table></div></details>`:'<p>Aucune ligne à vérifier. Les doublons seront ignorés et aucune fiche existante ne sera remplacée.</p>');const ready=p.addedContainers+p.addedInterventions>0&&estimatedBytes<19*1048576;if(estimatedBytes>=19*1048576)$('#containerImportError').textContent='Le contenu complet dépasserait la limite actuelle de 20 Mo du serveur. Aucun élément n’a été enregistré. Contactez l’administrateur pour augmenter la capacité de stockage des contenants.';$('#containerImportConfirmRow').hidden=!ready;$('#containerImportApply').disabled=!ready||!canEdit();}catch(error){$('#containerImportError').textContent=error.message;$('#containerImportStatus').textContent='Analyse interrompue.';}};$('#containerImportConfirmed').onchange=()=>{$('#containerImportApply').disabled=!importPlan||!$('#containerImportConfirmed').checked||!canEdit()};$('#containerImportApply').onclick=async()=>{if(!importPlan||!$('#containerImportConfirmed').checked)return;if(importSnapshot!==JSON.stringify(state())){$('#containerImportError').textContent='Les contenants ont changé depuis l’analyse. Relancez l’aperçu avant de confirmer.';return;}const next=structuredClone(read());next.containers=importPlan.containers;for(const container of next.containers){if(container.categoryMonths!==undefined&&container.categoryChecks!==undefined)continue;const matching=state().find(row=>row.subtype.trim().toLocaleLowerCase('fr')===container.subtype.trim().toLocaleLowerCase('fr'));if(matching){const settings=containerCategorySettings(matching);container.categoryMonths=settings.months;container.categoryChecks=[...settings.checks];}}$('#containerImportApply').disabled=true;$('#containerImportStatus').textContent='Enregistrement des fiches et interventions… Cela peut prendre jusqu’à 2 minutes.';if(await (saveContainers?saveContainers(next,{bulk:true}):save(next,false,{timeoutMs:120000,renderAfter:false}))){$('#containerImportDialog').close();list();}else{$('#containerImportStatus').textContent='Enregistrement non confirmé.';$('#containerImportError').textContent=$('#message').textContent||'Actualisez la page et vérifiez les contenants avant un nouvel essai.';importPlan=null;$('#containerImportConfirmed').checked=false;$('#containerImportConfirmRow').hidden=true;}};
 return {render:()=>{renderList();if(activeTab==='kpi'){renderKpi();renderAnalysis();}else if(activeTab==='controllers')renderControllers();else if(activeTab==='agenda')renderAgenda();else if(activeTab==='categories')renderCategories()},list,open,openInventory:id=>{switchTab('list');open(id,'inventory');},validate:containerRecordsValid};
}
