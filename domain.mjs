export function addMonths(date, months) {
  const [y,m,d]=date.split('-').map(Number);
  const target=new Date(Date.UTC(y,m-1+Number(months),1));
  const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
  target.setUTCDate(Math.min(d,last));
  return target.toISOString().slice(0,10);
}
export function latest(e) { return [...e.controls].sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created)[0]; }
export function due(e) { const c=latest(e); return c ? addMonths(c.date,e.months):(e.firstControlDate??null); }
export function status(e,today,anticipation) {
  if(e.archived)return 'Archivé';
  const date=due(e); if(!date)return 'À définir';
  if(!latest(e))return date<today?'En retard':'À faire';
  if(date<today)return 'En retard';
  const limit=new Date(today+'T00:00:00Z');limit.setUTCDate(limit.getUTCDate()+Number(anticipation));
  return date<=limit.toISOString().slice(0,10)?'À venir':'Planifié';
}

export function indicators(equipment, today) {
  const performed=equipment.reduce((total,e)=>total+e.controls.length,0);
  const active=equipment.filter(e=>!e.archived);
  const covered=active.filter(e=>{const date=due(e);return !!latest(e)&&date!==null&&date>=today}).length;
  const missing=active.filter(e=>!latest(e)).length;
  const overdue=active.filter(e=>{const date=due(e);return date!==null&&date<today}).length;
  return {total:active.length,performed,actions:performed,covered,missing,overdue,toDo:active.filter(e=>!latest(e)||(due(e)!==null&&due(e)<today)).length,percent:active.length?Math.round(covered/active.length*100):null};
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
