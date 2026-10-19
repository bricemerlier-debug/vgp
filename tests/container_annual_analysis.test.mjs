import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync,strFromU8} from 'fflate';
import {containerAnnualReport,containerInterventionAnalysis} from '../containers.mjs';
import {fillContainerReportPptx} from '../tools/container-report-pptx.mjs';

const containers=[
 {id:'a',number:'CD001',subtype:'R2 - VERTE',interventions:[
  {date:'2026-01-05',type:'préventif',parts:{Frein:'1',Roues:'OK'}},
  {date:'2026-01-08',type:'correctif',parts:{Frein:'2'}},
  {date:'2025-12-30',type:'préventif',parts:{Frein:'1'}}]},
 {id:'b',number:'SE001',subtype:'PC',interventions:[
  {date:'2026-02-02',type:'préventif',parts:{Chaîne:'1'}}]}
];
const annual=containerAnnualReport(containers,2026);
assert.equal(annual.total,3);
assert.deepEqual(annual.months.slice(0,3).map(m=>m.actions),[2,1,0]);
assert.equal(annual.groups.find(g=>g.type==='Cassettes R2 - VERTE').actions,2);
const analysis=containerInterventionAnalysis(containers,2026);
assert.equal(analysis.total,annual.total);
assert.equal(analysis.uniqueContainers,2);
assert.equal(analysis.types.find(t=>t.label==='préventif').count,2);
assert.equal(analysis.parts.find(p=>p.label==='Frein').count,2);
assert.equal(analysis.parts.find(p=>p.label==='Roues'),undefined);
assert.equal(analysis.recurrence[0].number,'CD001');
assert.equal(analysis.weeks.reduce((sum,w)=>sum+w.total,0),3);
const template=readFileSync(new URL('../assets/container-annual-report-template.pptx',import.meta.url));
const slide=strFromU8(unzipSync(fillContainerReportPptx(template,{year:2026,counts:annual.groups.map(g=>g.actions),total:annual.total}))['ppt/slides/slide1.xml']);
assert.ok(slide.includes('Bilan année 2026'));
assert.ok(!slide.includes('{{'));
console.log('Analyse et rapport annuel des contenants validés.');
