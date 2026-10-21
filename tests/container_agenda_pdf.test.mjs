import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {containerWeeklyAgenda} from '../containers.mjs';
import {buildContainerAgendaPdf} from '../container-agenda-pdf.mjs';

function readPdf(agenda,verify){
 const dir=mkdtempSync(join(tmpdir(),'container-agenda-'));
 try{
  const pdf=buildContainerAgendaPdf(agenda,{today:'2026-10-21'}),path=join(dir,'agenda.pdf');
  writeFileSync(path,pdf);
  const text=execFileSync('pdftotext',['-layout',path,'-'],{encoding:'utf8'});
  verify({pdf,text,path});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
const box=(number,dates,extra={})=>({id:number,number,type:'CA',subtype:'PLI AMIENS',interventions:dates.map(date=>({number:date,date,type:'préventif'})),...extra});

test('PDF de la semaine affichée : uniquement les préventifs encore à réaliser',()=>{
 const records=[box('CA001',['2025-10-20']),box('CA002',['2025-10-22']),box('FAIT',['2025-10-19','2026-10-19']),box('ARCHIVE',['2025-10-22'],{manualArchive:{date:'2026-10-18',comment:'Hors service',by:'test@example.test',at:'2026-10-18T12:00:00Z'}}),box('SUIVANTE',['2025-10-26']),box('SANS-DATE',[])];
 const snapshot=JSON.stringify(records),agenda=containerWeeklyAgenda(records,'2026-10-21','2026-10-21');
 readPdf(agenda,({pdf,text})=>{
  assert.match(text,/19\/10\/2026 au 25\/10\/2026/);
  assert.match(text,/2 contenants à contrôler/);
  assert.match(text,/CA001/);assert.match(text,/CA002/);assert.match(text,/PLI AMIENS/);
  for(const name of ['FAIT','ARCHIVE','SUIVANTE','SANS-DATE'])assert.ok(!text.includes(name));
  assert.match(text,/20\/10\/2025/);assert.match(text,/Observations du technicien/);
  assert.match(text,/Page 1 \/ 1/);assert.ok(Buffer.from(pdf).includes(Buffer.from('/Subtype /Image')));
 });
 const next=containerWeeklyAgenda(records,'2026-10-28','2026-10-21');
 readPdf(next,({text})=>{assert.match(text,/26\/10\/2026 au 01\/11\/2026/);assert.match(text,/SUIVANTE/);assert.ok(!text.includes('CA001'));});
 assert.equal(JSON.stringify(records),snapshot);
});

test('PDF multipage : toutes les lignes, accents, en-têtes répétés et marges imprimables',()=>{
 const agenda={start:'2026-10-19',end:'2026-10-25',days:[{entries:Array.from({length:110},(_,index)=>({number:'CA'+String(index).padStart(3,'0'),subtype:'Catégorie très longue avec bâche et chaîne '.repeat(4),due:'2026-10-22',last:'2025-10-22',done:false}))}]};
 readPdf(agenda,({text,path})=>{
  for(let index=0;index<110;index++)assert.ok(text.includes('CA'+String(index).padStart(3,'0')));
  assert.match(text,/chaîne/);assert.ok((text.match(/PRÉVENTIFS DE LA SEMAINE/g)||[]).length>1);
  const bbox=execFileSync('pdftotext',['-bbox',path,'-'],{encoding:'utf8'});
  for(const match of bbox.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g)){
   assert.ok(Number(match[1])>=40&&Number(match[3])<=555,match[0]);
   assert.ok(Number(match[2])>=0&&Number(match[4])<825,match[0]);
  }
 });
});

test('semaine sans préventif restant : PDF explicite et imprimable',()=>{
 readPdf({start:'2026-10-19',end:'2026-10-25',days:[]},({text})=>assert.match(text,/Aucun préventif restant à réaliser pour cette semaine/));
});
