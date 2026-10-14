export function equipmentName(e){return e.standardName||e.designation;}
export function addMonths(date, months) {
  const [y,m,d]=date.split('-').map(Number);
  const target=new Date(Date.UTC(y,m-1+Number(months),1));
  const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
  target.setUTCDate(Math.min(d,last));
  return target.toISOString().slice(0,10);
}
export function latest(e) { return [...e.controls].sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created)[0]; }
export function due(e){if(e.needsReverification)return null;const date=calculatedDeadline(e);if(!date)return null;const pending=obligationEntries(e).filter(o=>!o.done&&!o.excludedAt).map(o=>o.date).sort();return pending[0]||date;}
export function status(e,today){if(e.archived)return 'Archivé';const date=due(e);if(!date)return 'Situation à vérifier';if(date<today)return 'En retard';return today>=addMonths(date,-1)?'À faire':'Échéance à plus d’un mois';}
export function indicators(equipment,today){const k=dashboard(equipment,today);return {total:k.total,performed:k.performed,actions:k.performed,covered:k.upToDate,missing:k.missing,overdue:k.overdue,toDo:k.soon+k.overdue,percent:k.percent};}

export function generatePdf(lines) {
  // PDF with embedded text using the standard Helvetica font and WinAnsi encoding.
  const special={'€':128,'’':146,'‘':145,'“':147,'”':148,'–':150,'—':151,'œ':156,'Œ':140,'…':133};
  const encode=s=>Uint8Array.from([...s].map(c=>special[c]??(c.charCodeAt(0)<=255?c.charCodeAt(0):63)));
  const literal=s=>'('+[...s].map(c=>{const n=special[c]??(c.charCodeAt(0)<=255?c.charCodeAt(0):63);return '\\'+n.toString(8).padStart(3,'0')}).join('')+')';
  const wrapped=lines.flatMap(line=>String(line).split('\n').flatMap(row=>{const output=[];let part='';for(const word of row.split(/\s+/)){for(let i=0;i<word.length;i+=82){const chunk=word.slice(i,i+82);if(part.length+chunk.length+1>82){output.push(part);part=''}part+=(part?' ':'')+chunk}}output.push(part);return output}));
  const pages=[];for(let i=0;i<wrapped.length;i+=45)pages.push(wrapped.slice(i,i+45));if(!pages.length)pages.push([]);
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  const kids=[];
  pages.forEach((page,i)=>{const pageId=objects.length+1,streamId=pageId+1;kids.push(`${pageId} 0 R`);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);const stream=`BT /F1 11 Tf 15 TL 45 790 Td\n${page.map(line=>literal(line)+' Tj T*').join('\n')}\nET\nBT /F1 9 Tf 45 35 Td ${literal(`Page ${i+1} / ${pages.length}`)} Tj ET`;objects.push(`<< /Length ${encode(stream).length} >>\nstream\n${stream}\nendstream`)});
  objects[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  let out='%PDF-1.4\n',offsets=[0];objects.forEach((object,i)=>{offsets.push(encode(out).length);out+=`${i+1} 0 obj\n${object}\nendobj\n`});const xref=encode(out).length;out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return encode(out);
}

export function dashboard(equipment,today){
 const active=equipment.filter(e=>!e.archived),controlled=active.filter(e=>latestInspection(e)),upToDate=active.filter(e=>due(e)&&due(e)>=today).length;
 const overdue=active.filter(e=>status(e,today)==='En retard').length,soon=active.filter(e=>status(e,today)==='À faire').length,planned=active.filter(e=>status(e,today)==='Échéance à plus d’un mois').length,undefinedCount=active.filter(e=>!due(e)).length;
 return {total:active.length,archived:equipment.length-active.length,lostArchived:equipment.filter(lossArchived).length,controlled:controlled.length,upToDate,missing:active.length-controlled.length,percent:active.length?Math.round(upToDate/active.length*100):null,overdue,soon,planned,undefinedCount,performed:equipment.reduce((n,e)=>n+e.controls.filter(isInspection).length,0),anomalies:controlled.filter(e=>latestInspection(e).result!=='Bon état').length,
 results:['Bon état','Mauvais état — réparable','Mauvais état — à jeter'].map(result=>({label:result,count:controlled.filter(e=>latestInspection(e).result===result).length})),sectors:['A1','A2','B1','B2','B3','Pas de secteur',''].map(sector=>{const items=active.filter(e=>(e.sector||'')===sector);return {sector,total:items.length,controlled:items.filter(e=>due(e)&&due(e)>=today).length}})};
}

export function reminders(equipment) {
  if(equipment.archived)return [];
  const deadline=due(equipment);if(!deadline)return [];
  const before=days=>{const d=new Date(deadline+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-days);return d.toISOString().slice(0,10)};
  return [{kind:'month',label:'Un mois avant',date:addMonths(deadline,-1)},
    {kind:'twoWeeks',label:'Deux semaines avant',date:before(14)},
    {kind:'week',label:'Une semaine avant',date:before(7)},
    {kind:'deadline',label:'Jour de l’échéance',date:deadline}].map(r=>({...r,deadline,equipmentId:equipment.id}));
}

export function monthlyProgress(equipment,year,today){
 const months=Array.from({length:12},(_,index)=>({month:index+1,total:0,done:0,onTime:0,late:0,excluded:0,remaining:0,overdue:0,percent:null,completionPercent:null,entries:[]}));let unknownHistory=0;
 for(const e of equipment){unknownHistory+=e.controls.filter(c=>isInspection(c)&&!c.plannedDate).length;
 for(const o of obligationEntries(e)){if(Number(o.date.slice(0,4))!==Number(year))continue;const m=months[Number(o.date.slice(5,7))-1];const done=!!o.done&&o.controlDate<=today,onTime=done&&o.controlDate<=o.date,late=done&&!onTime;const end=new Date(Date.UTC(year,m.month,0)).toISOString().slice(0,10);const currentExcluded=!!o.excludedAt&&o.excludedAt<=today&&!done,excluded=currentExcluded&&o.excludedAt<=o.date,overdue=!done&&o.date<today&&!excluded;
 m.entries.push({...o,done,onTime,late,excluded,currentExcluded,archived:!!e.archived,overdue});}
 }
 for(const m of months){m.total=m.entries.length;m.done=m.entries.filter(o=>o.done).length;m.onTime=m.entries.filter(o=>o.onTime).length;m.late=m.entries.filter(o=>o.late).length;m.excluded=m.entries.filter(o=>o.excluded).length;m.remaining=m.entries.filter(o=>!o.done&&!o.currentExcluded&&!o.archived).length;m.overdue=m.entries.filter(o=>o.overdue).length;m.percent=m.total?Math.round(m.onTime/m.total*100):null;m.completionPercent=m.total?Math.round(m.done/m.total*100):null;}
 return {months,unknownHistory};
}

export function fillEmailTemplate(template,values){return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]):match)}

export function reportConclusion(result,verifier,date){
  const intro=`Je soussigné(e), ${verifier}, déclare avoir effectué la vérification du ${date}. `;
  if(result==='Bon état')return intro+'L’équipement est déclaré en bon état au regard du contrôle réalisé, sous réserve des observations indiquées. Cette déclaration porte sur le constat du vérificateur ; elle ne remplace pas la validation des critères de conformité applicables par l’entreprise.';
  if(result==='Mauvais état — réparable')return intro+'L’équipement présente un mauvais état réparable. Une réparation est nécessaire. Aucun avis favorable de conformité n’est délivré par ce rapport.';
  if(result==='Mauvais état — à jeter')return intro+'L’équipement présente un mauvais état et est orienté vers la mise au rebut. Aucun avis favorable de conformité n’est délivré par ce rapport.';
  return `L’équipement est déclaré introuvable le ${date} par ${verifier}. Aucun examen de son état n’a pu être effectué ; aucune conclusion de conformité ne peut être établie.`;
}

export function buildReportPdf(report,logo){
  const special={'€':128,'’':146,'‘':145,'“':147,'”':148,'–':150,'—':151,'œ':156,'Œ':140,'…':133};
  const encode=s=>Uint8Array.from([...s].map(c=>special[c]??(c.charCodeAt(0)<=255?c.charCodeAt(0):63)));
  const literal=s=>'('+[...String(s)].map(c=>'\\'+(special[c]??(c.charCodeAt(0)<=255?c.charCodeAt(0):63)).toString(8).padStart(3,'0')).join('')+')';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
  let imageId=null;if(logo){const bytes=atob(logo.data),hex=[...bytes].map(c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('')+'>';imageId=objects.length+1;objects.push(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${hex.length} >>\nstream\n${hex}\nendstream`)}
  const pages=[];let commands=[],y=660;
  const text=(value,x,lineY,size=10,bold=false,color='0.12 0.22 0.32')=>commands.push(`BT /${bold?'F2':'F1'} ${size} Tf ${color} rg ${x} ${lineY} Td ${literal(value)} Tj ET`);
  const rect=(x,top,w,h,color)=>commands.push(`${color} rg ${x} ${top-h} ${w} ${h} re f`);
  function header(){rect(0,842,595,8,'0.97 0.79 0.1');if(imageId){const w=Math.min(280,logo.width/Math.max(logo.width/280,logo.height/70)),h=w*logo.height/logo.width;commands.push(`q ${w} 0 0 ${h} 42 ${760-h/2} cm /Logo Do Q`)}else{text('GOODYEAR',42,765,31,true,'0.05 0.19 0.43');text('Logo officiel à importer',44,747,8,false,'0.4 0.45 0.5')}
    text('RAPPORT DE VÉRIFICATION',42,705,21,true);text('ÉQUIPEMENT VGP',42,683,10,true,'0.35 0.45 0.52');text(report.reportId,42,663,8.5);y=637}
  function finish(){commands.push('0.78 0.83 0.86 RG 42 46 m 553 46 l S');text(report.reportId,42,32,7);text(`Page ${pages.length+1}`,510,32,8);pages.push(commands.join('\n'));commands=[];header()}
  function ensure(h){if(y-h<70)finish()}
  function section(title){ensure(42);rect(42,y,511,24,'0.06 0.2 0.4');text(title,52,y-16,11,true,'1 1 1');y-=34}
  function wrap(value,size=10,max=91){const lines=[];for(const row of String(value).split('\n')){let current='';for(const word of row.split(/\s+/)){for(let i=0;i<word.length;i+=max){const part=word.slice(i,i+max);if(current.length+part.length+1>max){lines.push(current);current=''}current+=(current?' ':'')+part}}lines.push(current)}for(const line of lines){ensure(size+6);text(line,52,y,size);y-=size+5}y-=7}
  header();section('01  IDENTIFICATION DE L’ÉQUIPEMENT');wrap(report.equipment.designation,14,65);
  for(const [label,value] of report.fields){ensure(20);text(label,52,y,9,true);const values=String(value||'Non renseigné').match(/.{1,60}/g)||['Non renseigné'];for(const line of values){ensure(18);text(line,210,y,10);y-=16}y-=4}
  section('02  VÉRIFICATION');wrap(`Date du contrôle : ${report.date}`);wrap(`Vérificateur : ${report.verifier}`);wrap(`Résultat : ${report.result}`,12,75);
  section('03  OBSERVATIONS');wrap(report.observations||'Aucune observation renseignée.');
  section('04  CONCLUSION DU VÉRIFICATEUR');wrap(report.conclusion);ensure(90);text('Signature du vérificateur :',52,y,10,true);commands.push(`0.55 0.64 0.69 RG 52 ${y-32} m 340 ${y-32} l S`);text(`Date de vérification : ${report.date}`,52,y-50,8);text(`Code de vérification : ${report.reportId}`,52,y-64,7.5);text(report.snapshotNote,52,y-78,7);text('Document établi à partir des informations déclarées. Signature du vérificateur requise pour approbation.',52,y-90,7);
  finish();
  const kids=[];for(const stream of pages){const pageId=objects.length+1,streamId=pageId+1;kids.push(`${pageId} 0 R`);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${imageId?`/XObject << /Logo ${imageId} 0 R >>`:''} >> /Contents ${streamId} 0 R >>`);objects.push(`<< /Length ${encode(stream).length} >>\nstream\n${stream}\nendstream`)}
  objects[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  let out='%PDF-1.4\n',offsets=[0];objects.forEach((object,i)=>{offsets.push(encode(out).length);out+=`${i+1} 0 obj\n${object}\nendobj\n`});const xref=encode(out).length;out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return encode(out);
}

export function shiftDate(date,days){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export function weekStart(date){const d=new Date(date+'T00:00:00Z');return shiftDate(date,-((d.getUTCDay()+6)%7))}
export function weeklySchedule(equipment,start){const days=Array.from({length:7},(_,i)=>({date:shiftDate(start,i),entries:[]}));const end=days[6].date;
 for(const e of equipment.filter(e=>!e.archived)){const entries=new Map();for(const c of e.controls.filter(isInspection))if(c.plannedDate&&c.plannedDate>=start&&c.plannedDate<=end)entries.set(c.plannedDate,{equipmentId:e.id,name:equipmentName(e),identifier:e.identifier,done:true,late:c.date>c.plannedDate,date:c.plannedDate});const date=due(e);if(date&&date>=start&&date<=end&&!entries.has(date))entries.set(date,{equipmentId:e.id,name:equipmentName(e),identifier:e.identifier,done:false,date});for(const entry of entries.values())days.find(d=>d.date===entry.date).entries.push(entry)}
 return days;
}
export function equipmentAlerts(equipment,today){return equipment.filter(e=>!e.archived&&['À faire','En retard'].includes(status(e,today))).map(e=>({equipmentId:e.id,name:equipmentName(e),identifier:e.identifier,date:due(e),state:status(e,today)})).sort((a,b)=>a.date.localeCompare(b.date)||a.identifier.localeCompare(b.identifier,'fr'))}

// Tableau de bord opérationnel : contrôle réalisé et conformité restent distincts.
export function homeSummary(equipment,today){
 const active=equipment.filter(e=>!e.archived),year=Number(today.slice(0,4)),month=Number(today.slice(5,7));
 const progress=monthlyProgress(equipment,year,today),current=progress.months[month-1];
 const overdue=active.filter(e=>status(e,today)==='En retard'),soon=active.filter(e=>status(e,today)==='À faire'),undefinedDates=active.filter(e=>!due(e));
 const week=active.filter(e=>due(e)&&due(e)>=today&&due(e)<=shiftDate(today,7));
 const priorities=[...overdue,...soon].sort((a,b)=>due(a).localeCompare(due(b))||a.identifier.localeCompare(b.identifier,'fr',{numeric:true}));
 const issues=active.filter(e=>latestInspection(e)&&latestInspection(e).result!=='Bon état');
 return {current,unknownHistory:progress.unknownHistory,activeCount:active.length,overdue,soon,week,undefinedDates,priorities,issues};
}
export function isInspection(c){return !!c&&['Bon état','Mauvais état — réparable','Mauvais état — à jeter'].includes(c.result)&&typeof c.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(c.date)&&typeof c.intervenant==='string'&&!!c.intervenant.trim();}
export function latestInspection(e){return [...e.controls].filter(isInspection).sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created)[0];}
export function calculatedDeadline(e){
 if(e.needsReverification||latest(e)?.result==='Introuvable'&&!e.archived)return null;
 const c=latestInspection(e),v=e.dateValidation;
 if(v?.validated&&v.reason?.trim()&&v.source?.trim()&&v.by?.trim()){
  if(e.manualNextControlDate&&(e.manualControlId??null)===(c?.id??null))return e.manualNextControlDate;
  if(!c&&e.firstControlDate)return e.firstControlDate;
 }
 const p=e.periodicityValidation;
 if(c&&p?.validated&&p.months===e.months&&e.cycleControlId===c.id&&e.cycleSource?.fromValidatedDeadline&&e.cycleDeadline)return e.cycleDeadline;
 // Un contrôle réellement effectué relance le suivi selon la périodicité saisie,
 // y compris pour les fiches importées sans ancienne validation administrative.
 return c&&[3,6,9,12].includes(e.months)?addMonths(c.date,e.months):null;
}
export function obligationEntries(e){
 const entries=new Map((e.obligations||[]).map(o=>[o.id,{...o,equipmentId:e.id,identifier:o.identifier||e.identifier,name:o.name||equipmentName(e)}]));
 for(const c of e.controls){if(!c.plannedDate)continue;const id=`${e.id}|${c.plannedDate}`;let entry=entries.get(id)||{id,equipmentId:e.id,identifier:e.identifier,name:equipmentName(e),date:c.plannedDate,origin:'Association historique enregistrée',createdAt:c.date};
 if(isInspection(c)&&(!entry.controlDate||c.date<entry.controlDate)){entry={...entry,done:true,controlId:c.id,controlDate:c.date};}
 if(c.result==='Introuvable'&&!entry.done)entry={...entry,excludedAt:c.date,excludedReason:'Introuvable — enregistrement historique',originalControlId:c.id};
 entries.set(id,entry);
 }
 const date=calculatedDeadline(e);if(date){const id=`${e.id}|${date}`;if(!entries.has(id))entries.set(id,{id,equipmentId:e.id,identifier:e.identifier,name:equipmentName(e),date,origin:'Échéance validée',createdAt:e.dateValidation?.at?.slice(0,10)||e.periodicityValidation?.at?.slice(0,10)||null});}
 return [...entries.values()];
}
export function lossArchived(e){return e.archived&&[...(e.archiveHistory||[])].reverse().find(a=>a.type==='archive')?.reason==='Équipement perdu';}
export function freezeTracking(next,previous,today,actor){
 next.trackingVersion=2;
 for(const e of next.equipment){const old=previous?.equipment.find(x=>x.id===e.id),entries=new Map(obligationEntries(old||e).map(o=>[o.id,{...o}]));
  const oldDate=old?calculatedDeadline(old):null;const sameControl=old&&latestInspection(old)?.id&&latestInspection(old)?.id===latestInspection(e)?.id;if(sameControl&&oldDate&&old.months!==e.months&&e.manualNextControlDate===old.manualNextControlDate){e.cycleDeadline=oldDate;e.cycleControlId=latestInspection(old).id;e.cycleSource={fromValidatedDeadline:true,recordedAt:today,by:actor,previousMonths:old.months};}const newDate=calculatedDeadline(e);
  if(oldDate!==newDate&&oldDate&&oldDate>=today&&!e.controls.some(c=>isInspection(c)&&c.plannedDate===oldDate&&!old?.controls.some(previous=>previous.id===c.id))){const o=entries.get(`${e.id}|${oldDate}`);if(o&&!o.done&&!o.excludedAt)entries.set(o.id,{...o,excludedAt:today,excludedReason:'Modification d’échéance tracée',excludedBy:actor});}
  for(const entry of obligationEntries(e)){const oldEntry=entries.get(entry.id);entries.set(entry.id,oldEntry?{...entry,...oldEntry,...(entry.done&&!oldEntry.done?{done:true,controlId:entry.controlId,controlDate:entry.controlDate}:{})}:entry);}
  if(e.archived&&!old?.archived){const a=e.archiveHistory?.at(-1);for(const [id,o] of entries)if(!o.done&&!o.excludedAt)entries.set(id,{...o,excludedAt:a?.date||today,excludedReason:a?.reason||'Archivé',excludedBy:a?.requester||actor});}
  e.obligations=[...entries.values()];e.periodicityValidation??={validated:false,months:e.months,reason:'Périodicité historique à valider',by:actor,account:actor,at:new Date().toISOString()};
 }
 return next;
}
export function declareLoss(e,{id,date,author,comment,account,attachment=null,originalControlId=null}){
 if(!author?.trim()||!comment?.trim())throw Error('Renseignez l’auteur et le commentaire de recherche.');if(latestInspection(e)?.date>date)throw Error('La date de recherche précède un contrôle exploitable plus récent.');
 const event={id,type:'archive',workflow:'loss-declaration',reason:'Équipement perdu',date,requester:author.trim(),observations:comment.trim(),account,attachment,originalControlId,created:Date.now(),generated:false,snapshot:Object.fromEntries(['identifier','serialNumber','designation','category','location','sector','zone','team','owner','assignment'].map(k=>[k,e[k]||''])),previousRequest:e.pendingArchive||null};
 e.archiveHistory??=[];e.archiveHistory.push(event);e.archived=true;e.pendingArchive=null;return event;
}
export function reactivateFound(e,{id,date,author,comment,account}){
 if(!author?.trim()||!comment?.trim())throw Error('Renseignez l’auteur et le motif de réactivation.');if(!e.archived||e.archiveHistory.at(-1)?.date>date)throw Error('Vérifiez la date de réactivation après l’archivage.');
 e.archiveHistory.push({id,type:'restore',workflow:'restore-found',reason:'Matériel retrouvé — situation à vérifier',date,requester:author.trim(),observations:comment.trim(),account,created:Date.now(),generated:false});e.archived=false;e.needsReverification=true;e.lastFoundDate=date;e.pendingArchive=null;
}
export function migrationReview(data){
 const equipment=data.equipment;return {lossControls:equipment.reduce((n,e)=>n+e.controls.filter(c=>c.result==='Introuvable').length,0),activeLost:equipment.filter(e=>!e.archived&&latest(e)?.result==='Introuvable').length,datesToValidate:equipment.filter(e=>!e.archived&&!calculatedDeadline(e)).length,unlinked:equipment.reduce((n,e)=>n+e.controls.filter(c=>isInspection(c)&&!c.plannedDate).length,0)};
}
export function migrateTracking(data,today,actor){
 const next=typeof structuredClone==='function'?structuredClone(data):JSON.parse(JSON.stringify(data));
 for(const e of next.equipment){e.lossEvents??=[];for(const c of e.controls.filter(c=>c.result==='Introuvable'))if(!e.lossEvents.some(x=>x.originalControlId===c.id))e.lossEvents.push({id:`legacy-loss:${e.id}:${c.id}`,date:c.date,author:c.intervenant||'Auteur historique non renseigné',comment:c.observations||'Commentaire de recherche absent dans l’ancien enregistrement',originalControlId:c.id,attachment:c.attachment||null});
  const c=latest(e);if(!e.archived&&c?.result==='Introuvable')declareLoss(e,{id:`legacy-archive:${e.id}:${c.id}`,date:c.date,author:c.intervenant||'Auteur historique non renseigné',comment:c.observations||'Commentaire de recherche absent dans l’ancien enregistrement',account:actor,attachment:c.attachment,originalControlId:c.id});
 }
 return freezeTracking(next,data,today,actor);
}
