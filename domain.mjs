import {reminderDates} from './reminder-dates.mjs';
import {goodyearReportLogo} from './assets/report-logo.mjs';
import {pdfFonts} from './assets/report-fonts.mjs';
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
 results:['Bon état','Mauvais état — réparable','Mauvais état — à jeter','Réalisé — observations à traiter'].map(result=>({label:result,count:controlled.filter(e=>latestInspection(e).result===result).length})),sectors:['A1','A2','B1','B2','B3','Pas de secteur',''].map(sector=>{const items=active.filter(e=>(e.sector||'')===sector);return {sector,total:items.length,controlled:items.filter(e=>due(e)&&due(e)>=today).length}})};
}

export function reminders(equipment) {
  if(equipment.archived)return [];
  const deadline=due(equipment);if(!deadline)return [];
  return reminderDates(deadline).map(r=>({...r,equipmentId:equipment.id}));
}

export function monthlyProgress(equipment,year,today){
 const months=Array.from({length:12},(_,index)=>({month:index+1,total:0,done:0,onTime:0,late:0,excluded:0,remaining:0,overdue:0,percent:null,completionPercent:null,entries:[]}));let unknownHistory=0;
 const closureState=reason=>['Équipement perdu','Introuvable — enregistrement historique'].includes(reason)?'lost':reason==='Mis au rebut'?'scrapped':null;
 for(const e of equipment){unknownHistory+=e.controls.filter(c=>isInspection(c)&&!c.plannedDate).length;const archive=e.archived?[...(e.archiveHistory||[])].reverse().find(a=>a.type==='archive'):null,archiveState=closureState(archive?.reason);
 for(const o of obligationEntries(e)){if(Number(o.date.slice(0,4))!==Number(year))continue;const m=months[Number(o.date.slice(5,7))-1],inspectionDone=!!o.done&&o.controlDate<=today,reason=closureState(o.excludedReason)||(!o.excludedAt?archiveState:null),resolutionDate=closureState(o.excludedReason)?o.excludedAt:reason?archive?.date:null,closed=!!reason&&!!resolutionDate&&resolutionDate<=today,done=inspectionDone||closed,onTime=inspectionDone&&o.controlDate<=o.date,late=inspectionDone&&!onTime;
 const currentExcluded=!!o.excludedAt&&o.excludedAt<=today&&!done,excluded=currentExcluded&&o.excludedAt<=o.date,overdue=!done&&o.date<today&&!excluded,state=done&&archiveState&&archive.date<=today?archiveState:closed?reason:inspectionDone?'done':'pending';
 m.entries.push({...o,done,inspectionDone,onTime,late,excluded,currentExcluded,state,resolutionDate:closed?resolutionDate:archiveState&&archive.date<=today?archive.date:null,archived:!!e.archived,overdue});}
 }
 for(const m of months){m.total=m.entries.length;m.done=m.entries.filter(o=>o.done).length;m.onTime=m.entries.filter(o=>o.onTime).length;m.late=m.entries.filter(o=>o.late).length;m.excluded=m.entries.filter(o=>o.excluded).length;m.remaining=m.entries.filter(o=>!o.done&&!o.currentExcluded&&!o.archived).length;m.overdue=m.entries.filter(o=>o.overdue).length;m.percent=m.total?Math.round(m.onTime/m.total*100):null;m.completionPercent=m.total?Math.round(m.done/m.total*100):null;}
 return {months,unknownHistory};
}

// Cumul pondéré des échéances : les mois futurs ne pénalisent pas l’année en cours.
export function annualCompletion(report,year,today){const currentYear=Number(today.slice(0,4)),throughMonth=Number(year)<currentYear?12:Number(year)===currentYear?Number(today.slice(5,7)):0,months=report.months.filter(m=>m.month<=throughMonth),total=months.reduce((n,m)=>n+m.total,0),done=months.reduce((n,m)=>n+m.done,0);return {throughMonth,total,done,percent:total?Math.round(done*100/total):null};}

export function fillEmailTemplate(template,values){return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]):match)}

export function reportConclusion(result,verifier,date){
  const intro=`Je soussigné(e), ${verifier}, déclare avoir effectué la vérification du ${date}. `;
  if(result==='Bon état')return intro+'L’équipement est déclaré en bon état au regard du contrôle réalisé, sous réserve des observations indiquées. Cette déclaration porte sur le constat du vérificateur ; elle ne remplace pas la validation des critères de conformité applicables par l’entreprise.';
  if(result==='Mauvais état — réparable')return intro+'L’équipement présente un mauvais état réparable. Une réparation est nécessaire. Aucun avis favorable de conformité n’est délivré par ce rapport.';
  if(result==='Mauvais état — à jeter')return intro+'L’équipement présente un mauvais état et est orienté vers la mise au rebut. Aucun avis favorable de conformité n’est délivré par ce rapport.';
  if(result==='Réalisé — observations à traiter')return intro+'Le rapport APAVE contient des observations à traiter. Le contrôle est enregistré comme réalisé ; aucun avis favorable sur l’état ou la conformité n’est déduit de ces observations.';
  return `L’équipement est déclaré introuvable le ${date} par ${verifier}. Aucun examen de son état n’a pu être effectué ; aucune conclusion de conformité ne peut être établie.`;
}

export function buildReportPdf(report,logo){
  logo??=goodyearReportLogo;
  const special={'€':128,'’':146,'‘':145,'“':147,'”':148,'–':150,'—':151,'œ':156,'Œ':140,'…':133};
  const encode=s=>Uint8Array.from([...s].map(c=>special[c]??(c.charCodeAt(0)<=255?c.charCodeAt(0):63)));
  const literal=s=>'('+[...String(s)].map(c=>'\\'+(special[c]??(c.charCodeAt(0)<=255?c.charCodeAt(0):63)).toString(8).padStart(3,'0')).join('')+')';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','','','','','','',''];
  pdfFonts.forEach((font,index)=>{const fontId=3+index,descriptorId=5+index,streamId=7+index,bytes=atob(font.data),hex=[...bytes].map(c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('')+'>';objects[fontId-1]=`<< /Type /Font /Subtype /TrueType /BaseFont /${font.name} /FirstChar 32 /LastChar 255 /Widths [${font.widths.join(' ')}] /Encoding /WinAnsiEncoding /FontDescriptor ${descriptorId} 0 R >>`;objects[descriptorId-1]=`<< /Type /FontDescriptor /FontName /${font.name} /Flags 32 /FontBBox [${font.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight ${font.capHeight} /StemV ${index?120:80} /FontFile2 ${streamId} 0 R >>`;objects[streamId-1]=`<< /Length ${hex.length} /Length1 ${bytes.length} /Filter /ASCIIHexDecode >>\nstream\n${hex}\nendstream`;});
  let imageId=null;if(logo){const bytes=atob(logo.data),hex=[...bytes].map(c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('')+'>';imageId=objects.length+1;objects.push(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${hex.length} >>\nstream\n${hex}\nendstream`)}
  let signatureId=null;if(report.signature){const sign=report.signature,bytes=atob(sign.data),hex=[...bytes].map(c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('')+'>';signatureId=objects.length+1;objects.push(`<< /Type /XObject /Subtype /Image /Width ${sign.width} /Height ${sign.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${hex.length} >>\nstream\n${hex}\nendstream`);}
  const pages=[];let commands=[],y=658;
  const text=(value,x,lineY,size=10,bold=false,color='0.12 0.22 0.32')=>commands.push(`BT /${bold?'F2':'F1'} ${size} Tf ${color} rg ${x} ${lineY} Td ${literal(value)} Tj ET`);
  const rect=(x,top,w,h,color)=>commands.push(`${color} rg ${x} ${top-h} ${w} ${h} re f`);
  const width=(value,size,bold=false)=>[...String(value)].reduce((n,c)=>{const code=special[c]??(c.charCodeAt(0)<=255?c.charCodeAt(0):63);return n+(pdfFonts[bold?1:0].widths[code-32]??0)*size/1000},0);
  const lines=(value,size,maxWidth,bold=false)=>{const out=[];for(const row of String(value).split('\n')){let line='';for(const word of row.split(/\s+/)){if(!word)continue;if(width((line?line+' ':'')+word,size,bold)<=maxWidth){line+=(line?' ':'')+word;continue;}if(line){out.push(line);line='';}for(const c of word){if(width(line+c,size,bold)>maxWidth){out.push(line);line='';}line+=c;}}out.push(line);}return out;};
  function header(){rect(0,842,595,6,'1 0.82 0');if(imageId){const w=Math.min(220,logo.width*70/logo.height),h=w*logo.height/logo.width;commands.push(`q ${w} 0 0 ${h} 42 ${797-h} cm /Logo Do Q`);}else{text('GOODYEAR',42,775,27,true,'0 0.24 0.44');}
    text('AMIENS · SUIVI DES ÉQUIPEMENTS',42,740,9,false,'0.35 0.45 0.52');rect(363,799,190,64,'0 0.23 0.44');text('RAPPORT VGP',376,780,10,true,'1 1 1');const label='N° '+report.reportId;lines(label,14,164,true).slice(0,2).forEach((line,i)=>text(line,376,759-i*16,14,true,'1 1 1'));text(report.result==='Introuvable'?'DÉCLARATION D’INTROUVABLE':'RAPPORT DE VÉRIFICATION',42,703,20,true,'0 0.23 0.44');text(`${report.result==='Introuvable'?'Déclaration':'Contrôle'} du ${report.date}`,42,683,10);y=656;}
  function finish(){commands.push('0.78 0.83 0.86 RG 42 40 m 553 40 l S');pages.push(commands.join('\n'));commands=[];}
  function ensure(h){if(y-h<62){finish();header();}}
  function section(number,title){ensure(44);rect(42,y,511,25,'0.93 0.95 0.98');rect(42,y,29,25,'0 0.23 0.44');text(number,49,y-17,10,true,'1 1 1');text(title,82,y-17,10,true,'0 0.23 0.44');y-=42;}
  function wrap(value,size=10,maxWidth=491,bold=false){for(const line of lines(value,size,maxWidth,bold)){ensure(size+5);text(line,52,y,size,bold);y-=size+5;}y-=7;}
  header();section('01','IDENTIFICATION DE L’ÉQUIPEMENT');wrap(report.equipment.designation,14,491,true);if(report.snapshotNote?.includes('antérieur'))wrap(report.snapshotNote,9);
  for(const [label,value] of report.fields){const values=lines(String(value??'').trim()||'Non renseigné',10,325);for(let i=0;i<values.length;i++){ensure(20);if(i===0)text(label,52,y,10,true);text(values[i],217,y,10);y-=15;}y-=5;}
  section('02',report.result==='Introuvable'?'DÉCLARATION DU MATÉRIEL INTROUVABLE':'RÉSULTAT DE LA VÉRIFICATION');wrap(`Vérificateur : ${report.verifier}`,10);wrap(`Résultat : ${report.result}`,11,491,true);
  section('03','OBSERVATIONS');wrap(report.observations||'Aucune observation renseignée.',10);
  section('04','CONCLUSION ET SIGNATURE');wrap(report.conclusion,10);ensure(100);text('Signature du vérificateur',52,y,10,true);if(signatureId){if(report.signatureCurrent)text('Image issue de la fiche actuelle du contrôleur',52,y-14,8);const sign=report.signature,w=Math.min(230,sign.width*45/sign.height),h=w*sign.height/sign.width;commands.push(`q ${w} 0 0 ${h} 52 ${y-(report.signatureCurrent?22:10)-h} cm /Signature Do Q`);}commands.push(`0.55 0.64 0.69 RG 52 ${y-76} m 350 ${y-76} l S`);y-=95;
  finish();
  const kids=[];for(const [pageIndex,body] of pages.entries()){const stream=body+`\nBT /F1 8 Tf 0.35 0.45 0.52 rg 503 26 Td ${literal('Page '+(pageIndex+1)+' / '+pages.length)} Tj ET`;const pageId=objects.length+1,streamId=pageId+1;kids.push(`${pageId} 0 R`);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${imageId||signatureId?`/XObject << ${imageId?'/Logo '+imageId+' 0 R':''} ${signatureId?'/Signature '+signatureId+' 0 R':''} >>`:''} >> /Contents ${streamId} 0 R >>`);objects.push(`<< /Length ${encode(stream).length} >>\nstream\n${stream}\nendstream`)}
  objects[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  let out='%PDF-1.4\n',offsets=[0];objects.forEach((object,i)=>{offsets.push(encode(out).length);out+=`${i+1} 0 obj\n${object}\nendobj\n`});const xref=encode(out).length;out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return encode(out);
}

export function shiftDate(date,days){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export function weekStart(date){const d=new Date(date+'T00:00:00Z');return shiftDate(date,-((d.getUTCDay()+6)%7))}
export function weeklySchedule(equipment,start){
 const days=Array.from({length:7},(_,i)=>({date:shiftDate(start,i),entries:[]})),end=days[6].date;
 for(const e of equipment){const archive=[...(e.archiveHistory||[])].reverse().find(a=>a.type==='archive'),disposal=archive?.reason==='Mis au rebut'?e.controls.find(c=>c.id===archive.controlId&&isInspection(c)):null;
 for(const o of obligationEntries(e)){if(o.date<start||o.date>end)continue;const c=e.controls.find(c=>c.id===o.controlId&&isInspection(c)),done=!!o.done&&!!c;
 if(o.excludedAt&&!['Équipement perdu','Mis au rebut'].includes(o.excludedReason)&&!done)continue;
 if(!done&&e.archived&&!archive)continue;
 if(!done&&disposal&&o.date===addMonths(disposal.date,e.months)&&o.date!==disposal.plannedDate)continue;
 const currentReason=e.archived&&['Équipement perdu','Mis au rebut'].includes(archive?.reason)?archive.reason:null;
 const reason=currentReason||(!done?(['Équipement perdu','Mis au rebut'].includes(o.excludedReason)?o.excludedReason:e.archived?archive?.reason:null):c.result==='Mauvais état — à jeter'?'Mis au rebut':null);
 const state=reason==='Équipement perdu'?'lost':reason==='Mis au rebut'?'scrapped':done?'done':'pending';
 days.find(d=>d.date===o.date).entries.push({equipmentId:e.id,name:equipmentName(e),identifier:e.identifier,date:o.date,done,late:done&&c.date>o.date,state});
 }}
 for(const day of days)day.entries.sort((a,b)=>a.name.localeCompare(b.name,'fr')||a.identifier.localeCompare(b.identifier,'fr',{numeric:true}));return days;
}

// Avancement opérationnel : une recherche clôturée ou une mise au rebut traite aussi l’échéance.
export function weeklyCompletion(days){const entries=days.flatMap(day=>day.entries),total=entries.length,completed=entries.filter(e=>e.done||['lost','scrapped'].includes(e.state)).length;return {total,completed,percent:total?Math.round(completed*100/total):null};}

export function equipmentAlerts(equipment,today){return equipment.filter(e=>!e.archived&&['À faire','En retard'].includes(status(e,today))).map(e=>({equipmentId:e.id,name:equipmentName(e),identifier:e.identifier,date:due(e),state:status(e,today)})).sort((a,b)=>b.date.localeCompare(a.date)||a.identifier.localeCompare(b.identifier,'fr'))}

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
export function isInspection(c){return !!c&&(c.result!=='Réalisé — observations à traiter'||!!c.apave?.sourceKey)&&['Bon état','Mauvais état — réparable','Mauvais état — à jeter','Réalisé — observations à traiter'].includes(c.result)&&typeof c.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(c.date)&&typeof c.intervenant==='string'&&!!c.intervenant.trim();}
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
export function declareLoss(e,{id,date,author,comment,account,attachment=null,originalControlId=null,reportId=null,equipmentSnapshot=null,verifierId=null,reportSignature=undefined,time=undefined}){
 if(!author?.trim()||!comment?.trim())throw Error('Renseignez l’auteur et le commentaire de recherche.');if(latestInspection(e)?.date>date)throw Error('La date de recherche précède un contrôle exploitable plus récent.');
 const event={id,...(reportSignature!==undefined?{reportSignature}:{}),...(time?{time,timeZone:'Europe/Paris'}:{}),...(reportId?{reportId}:{}),...(equipmentSnapshot?{equipmentSnapshot}:{}),...(verifierId?{verifierId}:{}),type:'archive',workflow:'loss-declaration',reason:'Équipement perdu',date,requester:author.trim(),observations:comment.trim(),account,attachment,originalControlId,created:Date.now(),generated:false,snapshot:Object.fromEntries(['identifier','serialNumber','designation','category','location','sector','zone','team','owner','assignment'].map(k=>[k,e[k]||''])),previousRequest:e.pendingArchive||null};
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
