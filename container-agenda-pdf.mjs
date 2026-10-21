import {goodyearReportLogo} from './assets/report-logo.mjs';
import {pdfFonts} from './assets/report-fonts.mjs';

// Le document reprend les échéances non réalisées de la semaine affichée.
export function buildContainerAgendaPdf(agenda,{today,logo=goodyearReportLogo}={}){
 const dateFr=date=>date?date.split('-').reverse().join('/'):'—';
 const entries=agenda.days.flatMap(day=>day.entries).filter(entry=>!entry.done);
 const special={'€':128,'’':146,'‘':145,'“':147,'”':148,'–':150,'—':151,'œ':156,'Œ':140,'…':133};
 const code=char=>special[char]??(char.charCodeAt(0)<=255?char.charCodeAt(0):63);
 const encode=value=>Uint8Array.from([...value].map(code));
 const literal=value=>'('+[...String(value)].map(char=>'\\'+code(char).toString(8).padStart(3,'0')).join('')+')';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','','','','','','',''];
 for(const [index,font] of pdfFonts.entries()){
  const bytes=atob(font.data),hex=[...bytes].map(char=>char.charCodeAt(0).toString(16).padStart(2,'0')).join('')+'>';
  objects[2+index]=`<< /Type /Font /Subtype /TrueType /BaseFont /${font.name} /FirstChar 32 /LastChar 255 /Widths [${font.widths.join(' ')}] /Encoding /WinAnsiEncoding /FontDescriptor ${5+index} 0 R >>`;
  objects[4+index]=`<< /Type /FontDescriptor /FontName /${font.name} /Flags 32 /FontBBox [${font.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight ${font.capHeight} /StemV ${index?120:80} /FontFile2 ${7+index} 0 R >>`;
  objects[6+index]=`<< /Length ${hex.length} /Length1 ${bytes.length} /Filter /ASCIIHexDecode >>\nstream\n${hex}\nendstream`;
 }
 let logoId=null;
 if(logo){
  const hex=[...atob(logo.data)].map(char=>char.charCodeAt(0).toString(16).padStart(2,'0')).join('')+'>';
  logoId=objects.length+1;
  objects.push(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${hex.length} >>\nstream\n${hex}\nendstream`);
 }
 const pages=[],blue='0 0.23 0.44';let commands=[],y=0;
 const text=(value,x,top,size=9,bold=false,color=blue)=>commands.push(`BT /${bold?'F2':'F1'} ${size} Tf ${color} rg ${x} ${top} Td ${literal(value)} Tj ET`);
 const rect=(x,top,width,height,color)=>commands.push(`${color} rg ${x} ${top-height} ${width} ${height} re f`);
 const width=(value,size,bold)=>[...value].reduce((sum,char)=>sum+(pdfFonts[bold?1:0].widths[code(char)-32]??0)*size/1000,0);
 function wrap(value,maxWidth,size=9,bold=false){
  const output=[];let line='';
  for(const word of String(value||'—').split(/\s+/)){
   if(width((line?line+' ':'')+word,size,bold)<=maxWidth){line+=(line?' ':'')+word;continue;}
   if(line){output.push(line);line='';}
   for(const char of word){if(width(line+char,size,bold)>maxWidth){output.push(line);line='';}line+=char;}
  }
  output.push(line);return output;
 }
 function page(){
  rect(0,842,595,6,'1 0.84 0');
  if(logoId){const w=Math.min(200,logo.width*45/logo.height),h=w*logo.height/logo.width;commands.push(`q ${w} 0 0 ${h} 42 ${802-h} cm /Logo Do Q`);}
  else text('GOODYEAR',42,780,25,true);
  text('AMIENS · CONTENANTS',42,743,9,true);
  text('PRÉVENTIFS DE LA SEMAINE',42,712,21,true);
  text(`Du ${dateFr(agenda.start)} au ${dateFr(agenda.end)}`,42,691,12,true);
  text(`${entries.length} contenant${entries.length===1?'':'s'} à contrôler · Liste des préventifs restant à réaliser`,42,670,10);
  if(today)text(`Édité le ${dateFr(today)}`,415,743,9);
  text('Technicien : ____________________________________',42,643,10);
  text('Date : ____________________',370,643,10);
  rect(42,624,511,30,blue);
  for(const [label,x] of [['Échéance',49],['Contenant',125],['Catégorie',201],['Dernier préventif',365],['Contrôlé',504]])text(label,x,605,8,true,'1 1 1');
  y=594;
 }
 function finish(){pages.push(commands.join('\n'));commands=[];}
 page();
 for(const [index,entry] of entries.entries()){
  const cells=[wrap(dateFr(entry.due),65),wrap(entry.number,65,10,true),wrap(entry.subtype||'Non renseignée',150),wrap(dateFr(entry.last),124)];
  const count=Math.max(...cells.map(cell=>cell.length));
  for(let offset=0;offset<count;offset+=24){
   const lines=Math.min(24,count-offset),height=Math.max(43,lines*14+18);
   if(y-height<70){finish();page();}
   rect(42,y,511,height,index%2?'0.95 0.97 0.99':'1 1 1');
   const positions=[49,125,201,365];
   cells.forEach((cell,col)=>cell.slice(offset,offset+24).forEach((value,line)=>text(value,positions[col],y-18-line*14,col===1?10:9,col===1,col===0&&entry.due<today?'0.65 0.18 0.14':blue)));
   commands.push(`0.4 0.5 0.6 RG 516 ${y-25} 12 12 re S`);
   commands.push(`0.83 0.88 0.93 RG 42 ${y-height} m 553 ${y-height} l S`);y-=height;
  }
 }
 if(!entries.length){text('Aucun préventif restant à réaliser pour cette semaine.',49,y-25,11);y-=55;}
 if(y<165){finish();page();}
 y-=28;text('Observations du technicien',42,y,11,true);
 for(let i=1;i<=3;i++)commands.push(`0.8 0.85 0.9 RG 42 ${y-i*22} m 553 ${y-i*22} l S`);
 finish();
 const kids=[];
 for(const [index,body] of pages.entries()){
  commands=[];text('Goodyear Amiens · Préventifs des contenants',42,29,8);text(`Page ${index+1} / ${pages.length}`,493,29,8);
  const stream=body+'\n'+commands.join('\n'),pageId=objects.length+1,streamId=pageId+1;
  kids.push(`${pageId} 0 R`);
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${logoId?`/XObject << /Logo ${logoId} 0 R >>`:''} >> /Contents ${streamId} 0 R >>`);
  objects.push(`<< /Length ${encode(stream).length} >>\nstream\n${stream}\nendstream`);
 }
 objects[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
 let output='%PDF-1.4\n';const offsets=[0];
 for(const [index,object] of objects.entries()){offsets.push(encode(output).length);output+=`${index+1} 0 obj\n${object}\nendobj\n`;}
 const xref=encode(output).length;
 output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return encode(output);
}
