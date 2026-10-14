import {test} from 'node:test';import assert from 'node:assert/strict';import {historicalActivity} from '../history-metrics.mjs';
const gear=(id,extra={})=>({id,identifier:id,designation:'Fixture '+id,months:12,controls:[],...extra});
const manual=date=>({manualNextControlDate:date,manualControlId:null,dateValidation:{validated:true,reason:'Test fictif',source:'Fixture',by:'Testeur'}});
test('dates connues prioritaires, dédoublonnage et estimation selon périodicité sans création de contrôle',()=>{
 const source=[gear('real',{controls:[{id:'c',date:'2026-06-01',intervenant:'Testeur',result:'Bon état'}],memoryFlowTracking:{lastDate:'2026-06-01'}}),gear('declared',{memoryFlowTracking:{lastDate:'2026-06-14'},memoryFlowTrackingHistory:[{lastDate:'2026-06-14'}],...manual('2027-06-14')}),gear('estimated',{months:6,...manual('2026-11-14')}),gear('late',manual('2026-01-01')),gear('lost',{archived:true,...manual('2027-01-01')})],before=structuredClone(source),r=historicalActivity(source,2026,'2026-10-14');
 assert.equal(r.total,3);assert.equal(r.months[5].real,1);assert.equal(r.months[5].declared,1);assert.equal(r.months[5].estimated,0);assert.equal(r.months[4].estimated,1);assert.equal(r.months[4].entries[0].date,'2026-05-14');assert.match(r.months[4].entries[0].source,/réalisation non confirmée/);assert.deepEqual(source,before);
});
