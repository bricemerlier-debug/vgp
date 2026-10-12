export function addMonths(date, months) {
  const [y,m,d]=date.split('-').map(Number);
  const target=new Date(Date.UTC(y,m-1+Number(months),1));
  const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
  target.setUTCDate(Math.min(d,last));
  return target.toISOString().slice(0,10);
}
export function latest(e) { return [...e.controls].sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created)[0]; }
export function due(e) { const c=latest(e); if(e.manualNextControlDate&&(e.manualControlId??null)===(c?.id??null))return e.manualNextControlDate; return c ? addMonths(c.date,e.months):(e.firstControlDate??null); }
export function status(e,today) {
  if(e.archived)return 'Archivé';
  const date=due(e);if(!date)return 'À définir';
  if(date<today)return 'En retard';
  return today>=addMonths(date,-1)?'À faire':'Planifié';
}

export function indicators(equipment, today) {
  const performed=equipment.reduce((total,e)=>total+e.controls.length,0);
  const active=equipment.filter(e=>!e.archived);
  const covered=active.filter(e=>{const date=due(e);return !!latest(e)&&date!==null&&date>=today}).length;
  const missing=active.filter(e=>!latest(e)).length;
  const overdue=active.filter(e=>{const date=due(e);return date!==null&&date<today}).length;
  return {total:active.length,performed,actions:performed,covered,missing,overdue,toDo:active.filter(e=>['À faire','En retard'].includes(status(e,today))).length,percent:active.length?Math.round(covered/active.length*100):null};
}

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

export function dashboard(equipment,today,anticipation) {
  const active=equipment.filter(e=>!e.archived),controlled=active.filter(e=>latest(e));
  const overdue=active.filter(e=>status(e,today)==='En retard').length;
  const soon=active.filter(e=>status(e,today)==='À faire').length;
  const planned=active.filter(e=>status(e,today)==='Planifié').length;
  const undefinedCount=active.filter(e=>status(e,today)==='À définir').length;
  const missing=active.length-controlled.length;
  return {total:active.length,archived:equipment.length-active.length,controlled:controlled.length,missing,
    percent:active.length?Math.round(controlled.length/active.length*100):null,overdue,soon,planned,undefinedCount,
    performed:equipment.reduce((n,e)=>n+e.controls.length,0),
    results:['Bon état','Mauvais état — réparable','Mauvais état — à jeter','Introuvable'].map(result=>({label:result,count:controlled.filter(e=>latest(e).result===result).length})),
    sectors:['A1','A2','B1','B2','B3',''].map(sector=>{const items=active.filter(e=>(e.sector||'')===sector);return {sector,total:items.length,controlled:items.filter(e=>latest(e)).length}})};
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

export function monthlyProgress(equipment,year,today) {
  const months=Array.from({length:12},(_,index)=>({month:index+1,total:0,done:0,remaining:0,overdue:0,percent:null,entries:[]}));
  let unknownHistory=0;
  for(const e of equipment.filter(e=>!e.archived)){
    const entries=new Map();
    for(const c of e.controls){if(!c.plannedDate){unknownHistory++;continue}entries.set(c.plannedDate,{equipmentId:e.id,identifier:e.identifier,name:e.designation,date:c.plannedDate,done:true,controlDate:c.date})}
    const next=due(e);if(next&&!entries.has(next))entries.set(next,{equipmentId:e.id,identifier:e.identifier,name:e.designation,date:next,done:false});
    for(const entry of entries.values()){if(Number(entry.date.slice(0,4))!==Number(year))continue;const month=months[Number(entry.date.slice(5,7))-1];month.entries.push({...entry,overdue:!entry.done&&entry.date<today})}
  }
  for(const m of months){m.total=m.entries.length;m.done=m.entries.filter(e=>e.done).length;m.remaining=m.total-m.done;m.overdue=m.entries.filter(e=>e.overdue).length;m.percent=m.total?Math.round(m.done/m.total*100):null}
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
 for(const e of equipment.filter(e=>!e.archived)){const entries=new Map();for(const c of e.controls)if(c.plannedDate&&c.plannedDate>=start&&c.plannedDate<=end)entries.set(c.plannedDate,{equipmentId:e.id,name:e.designation,identifier:e.identifier,done:true,date:c.plannedDate});const date=due(e);if(date&&date>=start&&date<=end&&!entries.has(date))entries.set(date,{equipmentId:e.id,name:e.designation,identifier:e.identifier,done:false,date});for(const entry of entries.values())days.find(d=>d.date===entry.date).entries.push(entry)}
 return days;
}
export function equipmentAlerts(equipment,today){return equipment.filter(e=>!e.archived&&['À faire','En retard'].includes(status(e,today))).map(e=>({equipmentId:e.id,name:e.designation,identifier:e.identifier,date:due(e),state:status(e,today)})).sort((a,b)=>a.date.localeCompare(b.date)||a.identifier.localeCompare(b.identifier,'fr'))}
