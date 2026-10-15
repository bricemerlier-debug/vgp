// APAVE Leara: deterministic text extraction only. No image rendering or external services.
const apaveKey=v=>String(v??'').trim().toLocaleUpperCase('fr');
const apaveDate=v=>{const m=String(v).match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);if(!m)return null;const s=`${m[3]}-${m[2]}-${m[1]}`;return !isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s?s:null;};
export const apaveStates=Object.freeze({verified:'Vérification réalisée',partial:'Vérification partielle',not_verified:'Non vérifié',unknown:'À vérifier'});
export function apaveLines(items){
 const rows=[];
 for(const i of items.filter(i=>typeof i.str==='string'&&i.str.trim()).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){
  let r=rows.findLast(r=>Math.abs(r.y-i.transform[5])<2.3);if(!r){r={y:i.transform[5],items:[]};rows.push(r);}r.items.push(i);
 }
 return rows.sort((a,b)=>b.y-a.y).map(r=>({y:r.y,text:r.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim(),items:r.items}));
}
export function parseApavePages(pages){
 if(!Array.isArray(pages)||!pages.length)throw Error('PDF sans pages lisibles.');
 const texts=pages.map(p=>typeof p==='string'?p:p.text),cover=texts.slice(0,3).join('\n');
 const reportNumber=cover.match(/N[°º]\s*(?:DE\s+)?RAPPORT\s*:\s*([\w-]+)/i)?.[1];
 if(!reportNumber)throw Error('Numéro de rapport APAVE non reconnu. Aucun import possible.');
 const clean=t=>t.split('\n').filter(l=>!/^\s*(?:RAPPORT - EQUIPEMENTS|N[°º]\s*DE RAPPORT|Date\s*:.*Version modèle|Page\s+\d+\s*\/)/i.test(l)).join('\n').trim();
 const sections=[];
 for(let i=0;i<texts.length;i++)if(/Rapport de vérification/i.test(texts[i])&&/Date de la vérification/i.test(texts[i])){
  const order=texts[i].match(/N[°º]\s*Ordre\s*(\d+)(?!\d)/i)?.[1];
  if(!order)continue;sections.push({start:i,order});
 }
 const records=[];
 for(let s=0;s<sections.length;s++){
  const {start,order}=sections[s],end=sections[s+1]?.start??(texts.findIndex((t,i)=>i>start&&/VERIFICATIONS REGLEMENTAIRES/.test(t))>=0?texts.findIndex((t,i)=>i>start&&/VERIFICATIONS REGLEMENTAIRES/.test(t)):texts.length),head=clean(texts[start]);
  const contextDate=apaveDate(head.match(/Date de la vérification[^\n]*/i)?.[0]),verifier=head.match(/Vérificateur\s+([^\n]+)/i)?.[1]?.trim()||'';
  const name=head.match(/Rapport de vérification[^\n]*\n+(?:\d+\n+)?([^\n]+)/i)?.[1]?.trim()||'';
  const chunks=Array.from({length:end-start},(_,j)=>({page:start+j+1,text:clean(texts[start+j])}));
  const accessory=/N[°º]\s*Ordre\s*\d+\s*:\s*accessoire\s*\d+/i;
  const pieces=[];let current=null;
  for(const chunk of chunks){
   const re=/N[°º]\s*Ordre\s*(\d+)\s*:\s*accessoire\s*(\d+)/ig;const marks=[...chunk.text.matchAll(re)];
   if(!marks.length){if(current){current.parts.push(chunk.text);current.pages.push(chunk.page);}continue;}
   if(current&&marks[0].index>0){current.parts.push(chunk.text.slice(0,marks[0].index));current.pages.push(chunk.page);}
   for(let j=0;j<marks.length;j++){
    current={key:`${marks[j][1]}:accessoire:${marks[j][2]}`,parts:[chunk.text.slice(marks[j].index+marks[j][0].length,marks[j+1]?.index)],pages:[chunk.page]};pieces.push(current);
   }
  }
  if(!pieces.length&&!chunks.some(c=>accessory.test(c.text)))pieces.push({key:order,parts:chunks.map(c=>c.text),pages:chunks.map(c=>c.page)});
  for(const piece of pieces){
   const text=piece.parts.join('\n').trim(),isAccessory=piece.key.includes(':accessoire:');
   const ids=[];const add=(kind,value)=>{value=String(value||'').trim();if(value&&!/^(?:sans indication|inconnu|\/|néant|lot\b)/i.test(value)&&!ids.some(i=>i.kind===kind&&i.value===value))ids.push({kind,value});};
   if(isAccessory){add('repere',text.match(/(?:^|\n)Repère\s*(.*?)\s+Nombre(?:\s|$)/i)?.[1]);add('serie',text.match(/N[°º]\s*Série\s+([^\n]+)/i)?.[1]);}
   else{add('client',text.match(/(?:^|\n)Client\s*(.*?)\s+Bâtiment/i)?.[1]);add('repere',text.match(/Bâtiment\s*(.*?)\s+Service(?:\s|$)/i)?.[1]);add('serie',text.match(/N[°º]\s*Identification\s+(.+?)(?=\s+(?:Portée|Hauteur|Année|Capacité)|\n|$)/i)?.[1]);}
   const avis=isAccessory?text.match(/(?:^|\n)(?:\d+\s+)?Avis\s*([\s\S]*)/i)?.[1]?.trim():null;
   let resultText=avis??text.match(/Résultat de la vérification\s*([\s\S]*?)(?=\n(?:Observations|Liste des points vérifiés|N[°º]\s*Ordre)|$)/i)?.[1]?.trim()??'';
   let observations=isAccessory?(avis||''):text.match(/(?:^|\n)Observations\s*([\s\S]*?)(?=\n(?:Liste des points vérifiés|N[°º]\s*Ordre)|$)/i)?.[1]?.trim()||'';
   if(!isAccessory){const sourceObservations=piece.pages.map(n=>typeof pages[n-1]==='object'?pages[n-1].observationText:null).filter(Boolean);if(sourceObservations.length)observations=sourceObservations.join('\n\n');}
   const scopeText=isAccessory?'':text.match(/Contenu et conditions de la vérification\s*([\s\S]*?)(?=\nRésultat de la vérification|$)/i)?.[1]?.trim()||'';
   if(!resultText&&/Equipement non vérifié\s*:/i.test(scopeText))resultText=scopeText;
   const notVerified=/[ée]quipements? non v[ée]rifi[ée]|absents? ou non pr[ée]sent[ée]|v[ée]rification (?:non (?:effectu[ée]e|r[ée]alis[ée]e)|impossible)/i.test(resultText);
   const partial=/n['’]a pas [ée]t[ée] compl[èe]te|v[ée]rification (?:partielle|limit[ée]e)|impos[ée] une certaine limite à la v[ée]rification|essais?[^.]{0,65}(?:non r[ée]alis[ée]s?|impossibles)|n['’](?:a|ont) pas pu [êe]tre/i.test((scopeText+'\n'+resultText+'\n'+observations).replace(/\s+/g,' '));
   const state=notVerified?'not_verified':partial?'partial':resultText?'verified':'unknown';
   const issues=[];if(!ids.length)issues.push('Identifiant absent');if(!contextDate)issues.push('Date de vérification absente');if(!verifier)issues.push('Vérificateur absent');if(!resultText)issues.push('Résultat non reconnu');
   const observationTopics=isAccessory?[]:piece.pages.flatMap(n=>typeof pages[n-1]==='object'?pages[n-1].observationTopics||[]:[]);
   records.push({sourceKey:piece.key,observationTopics,name:isAccessory?text.split('\n').find(l=>l.trim()&&!/^\d+$/.test(l.trim()))||name:name.replace(/\s+\d+$/,''),identifiers:ids,date:notVerified?null:contextDate,contextDate,verifier,state,resultText,observations,scopeText,pages:[...new Set(piece.pages)],issues});
  }
 }
 if(!records.length)throw Error('Structure APAVE non reconnue ou PDF numérisé sans texte. Aucun contrôle déduit.');
 return {reportNumber,pageCount:pages.length,parserVersion:'leara-text-1',records};
}
export function matchApaveRecords(records,equipment){
 const index=new Map();for(const e of equipment)for(const value of [e.identifier,e.serialNumber]){const k=apaveKey(value);if(k){if(!index.has(k))index.set(k,new Set());index.get(k).add(e.id);}}
 const matches=records.map(record=>{const candidates=[...new Set(record.identifiers.flatMap(i=>[...(index.get(apaveKey(i.value))||[])]))];return {...record,candidates,equipmentId:candidates.length===1?candidates[0]:'',matchIssue:candidates.length>1?'Plusieurs fiches possibles':candidates.length===0?'Aucune correspondance exacte':''};});
 const counts=new Map();for(const r of matches)if(r.equipmentId)counts.set(r.equipmentId,(counts.get(r.equipmentId)||0)+1);
 return matches.map(r=>counts.get(r.equipmentId)>1?{...r,equipmentId:'',matchIssue:'Identifiant répété dans le rapport : choisir la fiche manuellement'}:r);
}
export async function extractApavePdf(bytes,pdfjs,onProgress=()=>{},signal=null){
 const task=pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:false,stopAtErrors:true});
 const abort=()=>task.destroy();signal?.addEventListener('abort',abort,{once:true});
 try{const pdf=await task.promise;if(pdf.numPages>1200)throw Error('Limite de 1 200 pages par rapport.');const pages=[];for(let n=1;n<=pdf.numPages;n++){if(signal?.aborted)throw Error('Analyse annulée.');const page=await pdf.getPage(n),content=await page.getTextContent();const lines=apaveLines(content.items),heading=lines.find(l=>l.text==='Observations');const observationText=heading?apaveLines(content.items.filter(i=>i.transform[4]>=220&&i.transform[5]<heading.y-4&&i.transform[5]>50)).map(l=>l.text).join('\n'):null;const observationTopics=heading?apaveLines(content.items.filter(i=>i.transform[4]<220&&i.transform[5]<heading.y-4&&i.transform[5]>50)).map(l=>l.text):[];pages.push({text:lines.map(l=>l.text).join('\n'),observationText,observationTopics});page.cleanup();onProgress(n,pdf.numPages);if(n%5===0)await new Promise(r=>setTimeout(r,0));}return parseApavePages(pages);}finally{signal?.removeEventListener('abort',abort);await task.destroy();}
}
export function apavePageLabel(pages){return pages.length===1?`Page ${pages[0]}`:pages.every((n,i)=>!i||n===pages[i-1]+1)?`Pages ${pages[0]} à ${pages.at(-1)}`:`Pages ${pages.join(', ')}`;}
export function applyApaveImport(state,report,choices,{actor,actorId=null,newId=()=>crypto.randomUUID(),at=new Date().toISOString(),confirmed=false}={}){
 if(!confirmed)throw Error('Confirmez les correspondances et les résultats avant l’import.');
 if(!/^[a-f0-9]{64}$/.test(report.sha256)||!report.reportNumber||!Number.isInteger(report.pageCount))throw Error('Référence du rapport invalide.');
 const next=structuredClone(state),existing=(next.apaveReports||[]).find(r=>r.sha256===report.sha256||r.reportNumber===report.reportNumber);
 if(existing&&(existing.sha256!==report.sha256||existing.reportNumber!==report.reportNumber))throw Error('Ce numéro de rapport existe avec un autre fichier.');
 const selected=choices.filter(c=>c.selected);if(!selected.length)throw Error('Sélectionnez au moins une ligne.');
 const seen=new Set(),performed=new Set();
 for(const choice of selected){
  const source=report.records.find(r=>r.sourceKey===choice.sourceKey),e=next.equipment.find(e=>e.id===choice.equipmentId);
  if(!source||!e)throw Error('Choisissez une fiche pour chaque ligne sélectionnée.');
  if(seen.has(source.sourceKey)||next.equipment.some(e=>(e.apaveChecks||[]).some(c=>c.reportHash===report.sha256&&c.sourceKey===source.sourceKey)))throw Error('Ce constat APAVE est déjà importé.');seen.add(source.sourceKey);
  const normalizedResult=choice.result||null;
  if(normalizedResult&&!['Bon état','Mauvais état — réparable','Mauvais état — à jeter'].includes(normalizedResult))throw Error('Résultat métier invalide.');
  if(normalizedResult&&(source.state!=='verified'||source.issues.length||!source.date||!source.verifier||e.archived||e.needsReverification))throw Error('Un constat non vérifié, partiel, incomplet ou sur du matériel hors suivi ne peut pas valider une VGP complète.');
  if(normalizedResult&&(performed.has(e.id)||next.equipment.some(x=>x.controls.some(c=>c.apave?.reportHash===report.sha256&&x.id===e.id))))throw Error('Plusieurs contrôles pour le même matériel dans ce rapport : vérifiez les doublons.');
  if(normalizedResult)performed.add(e.id);
  const controlId=normalizedResult?newId():null;
  const entry={...structuredClone(source),id:newId(),reportHash:report.sha256,reportNumber:report.reportNumber,normalizedResult,controlId,reviewedAt:at,reviewedBy:actor,reviewedById:actorId};
  (e.apaveChecks??=[]).push(entry);
  if(controlId){const snapshot=Object.fromEntries(['identifier','designation','serialNumber','location','sector','zone','team','owner'].map(k=>[k,e[k]||'']));snapshot.siteId=e.siteId;
   e.controls.push({id:controlId,reportId:`APAVE-${report.reportNumber}-${source.sourceKey}`,date:source.date,intervenant:source.verifier,result:normalizedResult,observations:source.observations,created:Date.parse(at),recordedAt:at,enteredBy:actor,enteredById:actorId,attachment:null,equipmentSnapshot:snapshot,apave:{reportHash:report.sha256,reportNumber:report.reportNumber,sourceKey:source.sourceKey,pages:source.pages}});
  }
 }
 if(!existing)(next.apaveReports??=[]).push({sha256:report.sha256,reportNumber:report.reportNumber,pageCount:report.pageCount,size:report.size,fileName:report.fileName,path:report.path,parserVersion:report.parserVersion,importedAt:at,importedBy:actor});
 return next;
}
export function apaveDataValid(state){
 if(state.apaveReports!==undefined&&(!Array.isArray(state.apaveReports)||new Set(state.apaveReports.map(r=>r?.sha256)).size!==state.apaveReports.length||!state.apaveReports.every(r=>r&&/^[a-f0-9]{64}$/.test(r.sha256)&&typeof r.reportNumber==='string'&&r.reportNumber.length<=100&&Number.isInteger(r.pageCount)&&r.pageCount>0&&r.pageCount<=1200&&Number.isInteger(r.size)&&r.size>=5&&r.size<=104857600)))return false;
 const seen=new Set();for(const e of state.equipment||[]){if(e.apaveChecks!==undefined&&!Array.isArray(e.apaveChecks))return false;for(const c of e.apaveChecks||[]){const r=state.apaveReports?.find(r=>r.sha256===c?.reportHash),key=c?.reportHash+':'+c?.sourceKey;if(!r||seen.has(key)||typeof c.id!=='string'||typeof c.sourceKey!=='string'||c.sourceKey.length>100||c.reportNumber!==r.reportNumber||!Object.hasOwn(apaveStates,c.state)||!Array.isArray(c.pages)||!c.pages.length||!c.pages.every((n,i)=>Number.isInteger(n)&&n>0&&n<=r.pageCount&&(!i||n>c.pages[i-1]))||!['name','verifier','resultText','observations','scopeText','reviewedAt','reviewedBy'].every(k=>typeof c[k]==='string')||!Array.isArray(c.issues)||!Array.isArray(c.identifiers)||c.identifiers.some(i=>typeof i.value!=='string'||typeof i.kind!=='string')||c.date!==null&&apaveDate(c.date?.split('-').reverse().join('/'))!==c.date)return false;if(c.state==='not_verified'&&(c.date!==null||c.controlId||c.normalizedResult))return false;if(c.controlId&&(c.state!=='verified'||c.issues.length||!e.controls.some(x=>x.id===c.controlId&&x.apave?.reportHash===c.reportHash&&x.apave?.sourceKey===c.sourceKey&&x.result===c.normalizedResult)))return false;seen.add(key);}
 for(const c of e.controls||[])if(c.apave){const a=(e.apaveChecks||[]).find(a=>a.controlId===c.id);if(!a||a.state!=='verified'||a.date!==c.date||a.verifier!==c.intervenant||a.normalizedResult!==c.result||a.observations!==c.observations||c.apave.reportHash!==a.reportHash||c.apave.sourceKey!==a.sourceKey||c.apave.reportNumber!==a.reportNumber||JSON.stringify(c.apave.pages)!==JSON.stringify(a.pages))return false;}
 }
 return true;
}
