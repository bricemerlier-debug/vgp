import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';

export function fillContainerReportPptx(template,{month,year,counts,total}){
 if(!Array.isArray(counts)||counts.length!==12||!Number.isInteger(total))throw new Error('Bilan mensuel incomplet.');
 const files=unzipSync(template);
 const path='ppt/slides/slide1.xml';
 if(!files[path])throw new Error('Modèle PowerPoint invalide.');
 let slide=strFromU8(files[path]);
 const replacements={MONTH:String(month).toLocaleUpperCase('fr'),TOTAL:String(total)};
 counts.forEach((count,index)=>{replacements[`COUNT_${index}`]=String(count)});
 for(const [key,value] of Object.entries(replacements)){
  const marker=`{{${key}}}`;
  if(!slide.includes(marker))throw new Error(`Champ ${key} absent du modèle PowerPoint.`);
  slide=slide.replaceAll(marker,value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char])));
 }
 files[path]=strToU8(slide);
 return zipSync(files,{level:6});
}
