import assert from 'node:assert/strict';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {containerPreventiveStatus,containerAnnualActivity,containerWeeklyAgenda,containerStatusCounts,containerLegacyScrapPlan,containerArchiveInfo,containerCategories,containerInterventionReport} from '../containers.mjs';
import {buildReportPdf} from '../domain.mjs';
const intervention=(date,number='1')=>({date,number,controller:'Stéphane G. / Autre',type:'préventif',generalState:'OK',comment:'Un frein HS, remis en état.',parts:{Frein:'Réparé'}});
const box=(number,dates,subtype='PC')=>({id:number,number,type:number.slice(0,2),subtype,interventions:dates.map((date,index)=>intervention(date,String(index+1)))});
for(const number of ['TR001','tp042']){
 const container=box(number,['2024-01-01']);
 assert.equal(containerPreventiveStatus(container,'2026-10-19').status,'exempt');
 assert.equal(containerPreventiveStatus(container).due,null);
 assert.equal(containerAnnualActivity([container],2024)[0].actions.length,1);
 assert.equal(containerAnnualActivity([container],2024)[0].due,0);
 assert.equal(containerWeeklyAgenda([container],'2025-01-01').total,0);
 assert.deepEqual(containerStatusCounts([container]),{current:0,overdue:0,unknown:0,exempt:1});
}
const containers=[box('CD068',['2023-01-01','2026-09-30'],'R2 - VERTE'),box('CE001',['2024-06-30']),box('CE002',['2024-07-01']),box('CE003',[])];
const before=JSON.stringify(containers);
const plan=containerLegacyScrapPlan(containers,{today:'2026-10-19',by:'test@example.test',at:'2026-10-19T10:00:00Z'});
assert.equal(JSON.stringify(containers),before);
assert.deepEqual(plan.targets.map(row=>row.number),['CE001']);
assert.deepEqual(plan.containers[1].interventions,containers[1].interventions);
assert.equal(containerArchiveInfo(plan.containers[1]).manual,true);
assert.equal(containerLegacyScrapPlan(plan.containers).targets.length,0);
assert.equal(containerCategories(plan.containers).find(row=>row.name==='PC').archived,1);
assert.equal(containerCategories(plan.containers).find(row=>row.name==='R2 - VERTE').interventions,2);
const directory=mkdtempSync(join(tmpdir(),'container-pdf-'));
try{
 const file=join(directory,'rapport.pdf');
 writeFileSync(file,buildReportPdf(containerInterventionReport(containers[0],containers[0].interventions[1])));
 const text=execFileSync('pdftotext',[file,'-'],{encoding:'utf8'});
 for(const term of ['RAPPORT CONTENANT','CD068','R2 - VERTE','Stéphane G. / Autre','30/09/2026','Un frein HS, remis en état.'])assert.ok(text.includes(term),term);
 assert.match(text,/Page 1 \/ 1/);assert.ok(!text.includes('N° d’intervention'));assert.ok(!text.includes('Sous-catégorie'));assert.ok(!text.includes('État général'));assert.ok(!text.includes('État des composants'));assert.ok(!text.includes('Frein : Réparé'));
 assert.ok(!text.includes('RAPPORT VGP'));assert.ok(!text.includes('RÉSULTAT DE LA VÉRIFICATION'));
}finally{rmSync(directory,{recursive:true,force:true});}
console.log('TR/TP, rebut avant juillet 2024, catégories et rapport PDF contenant validés.');
