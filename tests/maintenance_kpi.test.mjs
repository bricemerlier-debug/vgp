import {test} from 'node:test';import assert from 'node:assert/strict';import {maintenanceKpi} from '../maintenance-kpi.mjs';
const action=(id,level,status='todo',extra={})=>({id,level,status,created_at:'2026-07-01T12:00:00Z',initial_due_date:'2026-12-31',due_date:'2026-12-31',...extra});
test('résolution annuelle tous niveaux, reliquat inclus, reports non résolus, carnet sans double compte',()=>{
 const actions=[action('a',1,'done',{completed_entry_id:'repair'}),action('b',2),action('c',3,'todo',{deferrals:[{at:'2026-10-01T10:00:00Z',new_due_date:'2027-02-01'}],due_date:'2027-02-01'}),action('d',1,'todo',{created_at:'2025-01-01T00:00:00Z'}),action('old',1,'done',{created_at:'2025-01-01T00:00:00Z',completed_entry_id:'old'}),action('free',null)];
 const entries=[{id:'repair',date:'2026-07-20',kind:'Réparation'},{id:'repair',date:'2026-07-20',kind:'Réparation'},{id:'free',date:'2026-08-01',kind:'Entretien'},{id:'note',date:'2026-08-02',kind:'Observation'},{id:'old',date:'2025-08-01',kind:'Réparation'}];
 const r=maintenanceKpi({actions,entries},2026,'2026-10-15');assert.deepEqual(r.global,{total:4,done:1,percent:25});assert.deepEqual(r.levels.map(l=>l.percent),[50,0,0]);assert.equal(r.annualEntries.length,3);assert.equal(r.deferred.length,1);assert.equal(r.crossYear.length,1);assert.equal(r.carried.length,1);assert.equal(r.pendingJustification.length,1);assert.equal(r.unclassified,1);assert.equal(r.months[6].total,1);assert.equal(r.months[7].total,2);
});
test('un report et une résolution ultérieurs ne changent pas le bilan historique',()=>{
 const actions=[action('a',2,'done',{completed_entry_id:'repair',deferrals:[{at:'2027-01-02T12:00:00Z',new_due_date:'2027-06-01'}],due_date:'2027-06-01'})],entries=[{id:'repair',date:'2027-02-01',kind:'Réparation'}];
 const past=maintenanceKpi({actions,entries},2026,'2027-04-01');assert.equal(past.global.done,0);assert.equal(past.deferred.length,0);assert.equal(past.outstanding[0].due_date,'2026-12-31');assert.equal(past.annualEntries.length,0);
 const now=maintenanceKpi({actions,entries},2027,'2027-04-01');assert.equal(now.global.percent,100);assert.equal(now.annualEntries.length,1);assert.equal(now.carried.length,1);
});
test('aucun plan ne donne pas un faux 100 %, dates Paris et nouveau constat annuel',()=>{
 assert.equal(maintenanceKpi({actions:[],entries:[]},2026,'2026-10-15').global.percent,null);
 const r=maintenanceKpi({actions:[action('a',1,'todo',{created_at:'2025-12-31T23:30:00Z'})],entries:[]},2026,'2026-10-15');assert.equal(r.carried.length,0);assert.equal(r.global.total,1);
});

test('100 % est réservé à une résolution complète',()=>{const actions=Array.from({length:200},(_,i)=>action(String(i),1,i<199?'done':'todo',{completed_entry_id:String(i)})),entries=actions.slice(0,199).map(a=>({id:a.id,date:'2026-07-01'}));assert.equal(maintenanceKpi({actions,entries},2026,'2026-10-15').global.percent,99);});
