import test from 'node:test';
import assert from 'node:assert/strict';
import {containerNumberCleanupPlan,applyContainerNumberCleanup} from '../container-number-cleanup.mjs';
const entry=(id,number)=>({id,number,date:'2026-10-20',type:'curatif',controller:'A',generalState:'',comment:id,parts:{}});
const box=(id,number,interventions=[],extra={})=>({id,number,type:'CA',subtype:'Cartouche',interventions,...extra});
test('nettoie tout le parc et fusionne sans perdre les interventions',()=>{
 const data={containers:[box('old','CA025*',[entry('i1','1')],{manualArchive:{date:'2025-01-01',comment:'Rebut',by:'A',at:'2025-01-01T00:00:00Z'}}),box('active','CA025',[entry('i2','1')]),box('other','CA033**',[entry('i3','3')])]};
 const plan=containerNumberCleanupPlan(data);assert.equal(plan.renamed.length,2);assert.equal(plan.merges.length,1);
 const next=applyContainerNumberCleanup(data,plan);
 assert.equal(next.containers.length,2);assert.equal(next.containers[0].id,'active');
 assert.deepEqual(next.containers[0].interventions.map(item=>item.id),['i2','i1']);
 assert.deepEqual(next.containers[0].interventions.map(item=>item.number),['1','1-fusion-2']);
 assert.equal(next.containers[0].manualArchive,undefined);
 assert.equal(next.containers[0].numberMergeHistory[0].sourceId,'old');
 assert.equal(next.containers[0].numberMergeHistory[0].sourceNumber,'CA025*');
 assert.equal(next.containers[1].number,'CA033');assert.equal(data.containers.length,3);
});
test('une intervention strictement identique ne compte pas deux fois après fusion',()=>{
 const shared=entry('same','7');
 const data={containers:[box('a','CA007*',[shared]),box('b','CA007',[structuredClone(shared)])]};
 const next=applyContainerNumberCleanup(data,containerNumberCleanupPlan(data));
 assert.equal(next.containers.length,1);assert.equal(next.containers[0].interventions.length,1);
});
