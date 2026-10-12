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
