const containerImportParts=['Relâche','Élastique','Pompe','Frein','Inter','Roues','Carter','Bâti','Visserie','Rivets','Poignée','Palier','Timon','Pignon','Chaîne','Sabot','Sangle','Tambour','Verrou','Protection ressort','Ressort','Coupelle','Bâche','Bavette','Manchon','Excentrique','Bague','Galet','Enroulement / déroulement','Pédale','Amortisseur','Verrouillage','Levier','Rétroviseur','Vérin'];
const key=s=>String(s??'').trim().toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const identityKey=s=>String(s??'').trim().toLocaleLowerCase('fr');
const text=v=>v==null?'':String(v).trim();
function date(v){if(v instanceof Date&&!isNaN(v))return `${v.getUTCFullYear()}-${String(v.getUTCMonth()+1).padStart(2,'0')}-${String(v.getUTCDate()).padStart(2,'0')}`;if(typeof v==='number'&&v>20000&&v<100000){const d=new Date(Date.UTC(1899,11,30)+v*86400000);return date(d)}const s=text(v);let m=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;m=/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;return ''}
function partName(header){const h=key(header);return containerImportParts.find(p=>key(p)===h)||({'protectressort':'Protection ressort','enroulderoul':'Enroulement / déroulement','verouillage':'Verrouillage','bache':'Bâche'})[h]||''}
function rowsFromSheet(rows){if(!Array.isArray(rows))throw Error('Feuille Excel illisible.');const headerAt=rows.findIndex(r=>{const h=(r||[]).map(key);return h.some(x=>x.includes('intervention'))&&h.some(x=>x.includes('equipement'))&&h.includes('date')&&h.includes('type')&&h.includes('type1')});if(headerAt<0)throw Error('Colonnes non reconnues : il faut N° d’intervention, # équipement, date, Type et Type1.');const headers=rows[headerAt].map(h=>String(h??'').trim()),idx={};headers.forEach((h,i)=>idx[key(h)]=i);const find=(...keys)=>keys.map(k=>idx[key(k)]).find(i=>i!==undefined), fields={number:find("N° d'intervention",'N intervention','numero intervention'),container:find('# équipement','equipement'),date:find('date'),controller:find('controleur','contrôleur'),type:find("Type d'interv.",'type intervention'),comment:find('commentaire'),generalState:find('etat general','état général'),containerType:find('type'),subtype:find('type1')};if(Object.values(fields).some(v=>v===undefined))throw Error('Certaines colonnes requises sont absentes.');const parts=containerImportParts.map(name=>({name,index:headers.findIndex(h=>partName(h)===name)})).filter(x=>x.index>=0);const out=[];for(let n=headerAt+1;n<rows.length;n++){const r=rows[n]||[];if(r.every(v=>v==null||text(v)===''))continue;const row={line:n+1,number:text(r[fields.container]),intervention:text(r[fields.number]),date:date(r[fields.date]),controller:text(r[fields.controller]),type:text(r[fields.containerType]),subtype:text(r[fields.subtype]),kind:text(r[fields.type]),comment:text(r[fields.comment]),generalState:text(r[fields.generalState]),parts:Object.fromEntries(parts.map(p=>[p.name,text(r[p.index])]).filter(([,v])=>v))};out.push(row);}return out;}
function rowSignature(r){if(!r.intervention||!r.date||!r.comment)return '';return [identityKey(r.intervention),r.date,key(r.controller),key(r.type),key(r.subtype),key(r.kind),key(r.comment),key(r.generalState)].join('\u0000');}
function recoverMissingContainerNumbers(rows){const bySignature=new Map();for(const r of rows){const signature=rowSignature(r);if(!signature||!r.number)continue;const candidates=bySignature.get(signature)||[];candidates.push(r);bySignature.set(signature,candidates);}let recovered=0;const result=rows.map(r=>{if(r.number)return r;const signature=rowSignature(r),candidates=(signature&&bySignature.get(signature)||[]).filter(other=>other.sourceFile!==r.sourceFile),containerNumbers=new Map(candidates.map(other=>[identityKey(other.number),other]));if(containerNumbers.size!==1)return r;const source=[...containerNumbers.values()][0];recovered++;return {...r,number:source.number,type:r.type||source.type,subtype:r.subtype||source.subtype,recoveredContainerFrom:source.file};});return {rows:result,recovered};}
export async function analyzeContainerFiles(files,existing){if(!files.length)throw Error('Sélectionnez au moins un classeur Excel.');let totalSize=0,rows=[];for(const [fileIndex,file] of files.entries()){totalSize+=file.size;if(!/\.(xlsx|xlsm)$/i.test(file.name))throw Error(`${file.name} : choisissez un fichier .xlsx ou .xlsm.`);if(file.size>30*1024*1024)throw Error(`${file.name} dépasse la limite de 30 Mo.`);let sheet;try{sheet=await globalThis.VGPReadExcel(file,'Données')}catch{sheet=await globalThis.VGPReadExcel(file)}rows.push(...rowsFromSheet(sheet).map(r=>({...r,file:file.name,sourceFile:fileIndex})));}if(totalSize>100*1024*1024)throw Error('La taille cumulée des classeurs ne peut pas dépasser 100 Mo.');const recovered=recoverMissingContainerNumbers(rows);return plan(recovered.rows,existing,recovered.recovered);}
export function planContainerCategoryImport(rows,existing){
 const byNumber=new Map((existing||[]).map(container=>[identityKey(container.number),container]));
 const grouped=new Map(),issues=[];let lines=0;
 for(const row of rows){
  lines++;
  const number=text(row.number),category=text(row.category),subcategory=text(row.subcategory),found=byNumber.get(identityKey(number));
  if(!number||!category||!subcategory||!found){issues.push({...row,reason:!number?'Numéro d’équipement absent':!found?'Fiche introuvable':!category?'Type1 (catégorie) absent':'Type (sous-catégorie) absent'});continue;}
  const entry=grouped.get(identityKey(number))||{number:found.number,category,subcategory,lines:[],conflict:false};
  if(key(entry.category)!==key(category)||key(entry.subcategory)!==key(subcategory))entry.conflict=true;
  entry.lines.push(row.line);grouped.set(identityKey(number),entry);
 }
 const containers=structuredClone(existing||[]),changes=[],unchanged=[];
 for(const entry of grouped.values()){
  if(entry.conflict){issues.push({...entry,reason:'Valeurs différentes pour ce même équipement : fiche non modifiée'});continue;}
  const target=containers.find(container=>identityKey(container.number)===identityKey(entry.number));
  if(target.subtype===entry.category&&target.type===entry.subcategory){unchanged.push(entry);continue;}
  changes.push({...entry,previousCategory:target.subtype,previousSubcategory:target.type});
  target.type=entry.subcategory;target.subtype=entry.category;
  if(key(entry.category)!==key(entry.previousCategory)){delete target.categoryMonths;delete target.categoryChecks;}
 }
 for(const target of containers){
  if(target.categoryMonths!==undefined&&target.categoryChecks!==undefined)continue;
  const peer=containers.find(other=>other!==target&&key(other.subtype)===key(target.subtype)&&other.categoryMonths!==undefined&&other.categoryChecks!==undefined);
  if(peer){target.categoryMonths=peer.categoryMonths;target.categoryChecks=[...peer.categoryChecks];}
 }
 const categories=[...new Map(changes.map(row=>[key(row.category)+'\u0000'+key(row.subcategory),{category:row.category,subcategory:row.subcategory}])).values()].sort((a,b)=>a.category.localeCompare(b.category,'fr')||a.subcategory.localeCompare(b.subcategory,'fr'));
 return {containers,lines,changes,unchanged,issues,categories};
}
export async function analyzeContainerCategoryFiles(files,existing){
 if(!files.length)throw Error('Sélectionnez au moins un classeur Excel.');
 const rows=[];let totalSize=0;
 for(const file of files){
  if(!/\.(xlsx|xlsm)$/i.test(file.name))throw Error(`${file.name} : choisissez un fichier .xlsx ou .xlsm.`);
  if(file.size>30*1024*1024)throw Error(`${file.name} dépasse la limite de 30 Mo.`);
  totalSize+=file.size;
  let sheet;try{sheet=await globalThis.VGPReadExcel(file,'Données')}catch{sheet=await globalThis.VGPReadExcel(file)}
  const headerAt=sheet.findIndex(row=>{const names=(row||[]).map(key);return names.some(name=>name.includes('equipement'))&&names.includes('type')&&names.includes('type1')});
  if(headerAt<0)throw Error(`${file.name} : colonnes « # équipement », « Type » et « Type1 » introuvables.`);
  const names=sheet[headerAt].map(key),numberAt=names.findIndex(name=>name.includes('equipement')),typeAt=names.indexOf('type'),type1At=names.indexOf('type1');
  for(let index=headerAt+1;index<sheet.length;index++){
   const row=sheet[index]||[];if(row.every(value=>!text(value)))continue;
   rows.push({file:file.name,line:index+1,number:row[numberAt],subcategory:row[typeAt],category:row[type1At]});
  }
 }
 if(totalSize>100*1024*1024)throw Error('La taille cumulée des classeurs dépasse 100 Mo.');
 return planContainerCategoryImport(rows,existing);
}
function plan(rows,existing,recoveredContainerNumbers=0){const containers=structuredClone(existing||[]),byContainer=new Map(containers.map(c=>[identityKey(c.number),c])),byIntervention=new Set(containers.flatMap(c=>c.interventions.map(i=>identityKey(c.number)+'\u0000'+identityKey(i.number)))),seen=new Set();let addedContainers=0,addedInterventions=0,duplicates=0,errors=0;const issues=[],conflicts=[];for(const r of rows){if(!r.number||!r.intervention||!r.date||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)){errors++;issues.push({...r,reason:!r.number?'Numéro de contenant absent (aucune correspondance fiable dans les autres classeurs)':!r.intervention?'N° d’intervention absent':'Date absente ou invalide'});continue;}const ikey=identityKey(r.number)+'\u0000'+identityKey(r.intervention);if(seen.has(ikey)||byIntervention.has(ikey)){duplicates++;continue;}seen.add(ikey);let c=byContainer.get(identityKey(r.number));if(!c){c={id:crypto.randomUUID(),number:r.number,type:r.type,subtype:r.subtype,interventions:[]};containers.push(c);byContainer.set(identityKey(r.number),c);addedContainers++;}else{if(r.type&&c.type&&key(r.type)!==key(c.type)||r.subtype&&c.subtype&&key(r.subtype)!==key(c.subtype))conflicts.push({...r,reason:'Type ou Type1 différent de la fiche existante : valeurs existantes conservées'});if(!c.type&&r.type)c.type=r.type;if(!c.subtype&&r.subtype)c.subtype=r.subtype;}c.interventions.push({number:r.intervention,date:r.date,controller:r.controller,type:r.kind,generalState:r.generalState,comment:r.comment,parts:r.parts});byIntervention.add(ikey);addedInterventions++;}const reasons=Object.entries(issues.reduce((m,r)=>(m[r.reason]=(m[r.reason]||0)+1,m),{})).map(([reason,count])=>({reason,count}));return {containers,rows:rows.length,addedContainers,addedInterventions,duplicates,errors,recoveredContainerNumbers,issueCount:issues.length,conflictCount:conflicts.length,reasons,issues:issues.slice(0,40),conflicts:conflicts.slice(0,30),files:[...new Set(rows.map(r=>r.file))]};}
