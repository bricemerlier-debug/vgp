import {goodyearReportLogo} from './assets/report-logo.mjs';
import {pdfFonts} from './assets/report-fonts.mjs';

// PDF A4 de l'agenda hebdomadaire VGP, présenté en tableau comme l'agenda Contenants.
export function buildVgpAgendaPdf(days,equipment,{preparedOn,logo=goodyearReportLogo}={}){
 const dateFr=value=>value?value.split('-').reverse().join('/'):'—';
 const equipmentById=new Map(equipment.map(item=>[item.id,item]));
 const entries=days.flatMap(day=>day.entries
  .filter(entry=>!entry.done&&!['lost','scrapped'].includes(entry.state))
  .map(entry=>({date:day.date,entry,item:equipmentById.get(entry.equipmentId)})));
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
 const textWidth=(value,size,bold)=>[...value].reduce((sum,char)=>sum+(pdfFonts[bold?1:0].widths[code(char)-32]??0)*size/1000,0);
 function wrap(value,maxWidth,size=8,bold=false){
  const output=[];let line='';
  for(const word of String(value||'—').split(/\s+/)){
   if(textWidth((line?line+' ':'')+word,size,bold)<=maxWidth){line+=(line?' ':'')+word;continue;}
   if(line){output.push(line);line='';}
   for(const char of word){if(line&&textWidth(line+char,size,bold)>maxWidth){output.push(line);line='';}line+=char;}
  }
  if(line)output.push(line);
  return output.length?output:['—'];
 }
 function page(){
  rect(0,842,595,6,'1 0.84 0');
  if(logoId){const width=Math.min(190,logo.width*42/logo.height),height=width*logo.height/logo.width;commands.push(`q ${width} 0 0 ${height} 42 ${802-height} cm /Logo Do Q`);}
  else text('GOODYEAR',42,780,25,true);
  text('ENGINEERING PLANT FLOOR · VGP',42,743,9,true);
  text('CONTRÔLES À FAIRE CETTE SEMAINE',42,712,20,true);
  text(`Du ${dateFr(days[0]?.date)} au ${dateFr(days[6]?.date)}`,42,690,12,true);
  text(`${entries.length} équipement${entries.length===1?'':'s'} à contrôler`,42,670,10);
  if(preparedOn)text(`Édité le ${dateFr(preparedOn)}`,430,743,9);
  text('Technicien : ____________________________________',42,643,10);
  text('Date : ____________________',370,643,10);
  rect(42,624,511,31,blue);
  for(const [label,x] of [['Échéance',48],['N° interne',101],['Équipement',157],['N° série',258],['Secteur',327],['Propriétaire',383],['Localisation',470]])text(label,x,605,7.5,true,'1 1 1');
  y=593;
 }
 function finish(){pages.push(commands.join('\n'));commands=[];}
 page();
 const positions=[48,101,157,258,327,383,470],widths=[48,51,96,65,52,82,78];
 entries.forEach(({date,entry,item},index)=>{
  const cells=[
   wrap(dateFr(date),widths[0],7.5),
   wrap(entry.identifier,widths[1],7.5,true),
   wrap(entry.name||'Équipement',widths[2],7.5),
   wrap(item?.serialNumber||'Non renseigné',widths[3],7.5),
   wrap(item?.sector||'Non renseigné',widths[4],7.5),
   wrap(item?.owner||'Non renseigné',widths[5],7.5),
   wrap(item?.location||'Non renseignée',widths[6],7.5)
  ];
  const lineCount=Math.max(...cells.map(cell=>cell.length)),height=Math.max(38,lineCount*10+14);
  if(y-height<78){finish();page();}
  rect(42,y,511,height,index%2?'0.95 0.97 0.99':'1 1 1');
  cells.forEach((cell,column)=>cell.forEach((line,lineIndex)=>text(line,positions[column],y-16-lineIndex*10,7.5,column===1,column===0&&date<preparedOn?'0.65 0.18 0.14':blue)));
  commands.push(`0.83 0.88 0.93 RG 42 ${y-height} m 553 ${y-height} l S`);
  y-=height;
 });
 if(!entries.length){text('Aucun contrôle restant à faire cette semaine.',49,y-25,11);y-=55;}
 if(y<155){finish();page();}
 y-=24;text('OBSERVATIONS DU TECHNICIEN',42,y,10,true);
 for(let index=1;index<=3;index++)commands.push(`0.8 0.85 0.9 RG 42 ${y-index*22} m 553 ${y-index*22} l S`);
 finish();
 const kids=[];
 for(const [index,body] of pages.entries()){
  commands=[];text('Engineering Plant Floor · Agenda VGP',42,29,8);text(`Page ${index+1} / ${pages.length}`,493,29,8);
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
