import assert from 'node:assert/strict';
import test from 'node:test';
import {october2026Inventory,inventoryRecoveryPlan,applyInventoryRecovery} from '../container-inventory-recovery.mjs';
import {containerArchiveInfo,containerPreventiveStatus} from '../containers.mjs';
const intervention=(comment,date='2025-01-01')=>({number:'1',date,type:'curatif',controller:'A',generalState:'',comment,parts:{}});
const box=(id,number,extra={})=>({id,number,type:'CA',subtype:'Cartouche',interventions:[],...extra});
test('le relevé des captures compte 91 numéros distincts dont CA201 une fois',()=>{
 assert.equal(october2026Inventory.length,91);assert.equal(new Set(october2026Inventory).size,91);assert.ok(october2026Inventory.includes('CA272'));
});
test('une fiche étoilée archivée est retrouvée, réactivée et conserve une trace',()=>{
 const original={equipment:[{id:'v',identifier:'VGP*01',controls:[]}],containers:[box('a','CA272*',{manualArchive:{date:'2025-01-01',comment:'Mise au rebut',by:'A',at:'2025-01-01T12:00:00Z'}}),box('b','CA033*',{interventions:[intervention('Mis au rebut')]})]};
 const before=structuredClone(original),plan=inventoryRecoveryPlan(original,['CA272','CA033']);
 assert.equal(plan.ready,true);assert.equal(plan.reactivate.length,2);assert.equal(plan.changes.length,2);
 const next=applyInventoryRecovery(original,plan,{date:'2026-10-20',by:'test@example.test',at:'2026-10-20T12:00:00Z'});
 assert.deepEqual(original,before);assert.equal(next.containers[0].number,'CA272');assert.equal(next.containers[1].number,'CA033');assert.equal(next.equipment[0].identifier,'VGP*01');
 for(const container of next.containers){assert.equal(containerArchiveInfo(container),null);assert.equal(container.inventoryHistory[0].comment,'Inventaire fait le 20/10/2026. Contenant retrouvé et remis en circulation.');assert.equal(containerPreventiveStatus(container,'2026-10-20').status,'unknown');}
 assert.deepEqual(next.containers[0].inventoryHistory[0].previousArchive,before.containers[0].manualArchive);
 assert.equal(next.containers[1].interventions[0].comment,'Mis au rebut');
 next.containers[1].interventions.push(intervention('Mis au rebut de nouveau','2026-10-20'));
 assert.equal(containerArchiveInfo(next.containers[1]).comment,'Mis au rebut de nouveau');
});
test('une collision après suppression des étoiles fusionne les fiches',()=>{
 const original={equipment:[],containers:[box('a','CA272*'),box('b','CA272')]};const plan=inventoryRecoveryPlan(original,['CA272']);
 assert.equal(plan.ready,true);assert.equal(plan.ambiguous.length,0);assert.equal(plan.merges.length,1);
 const next=applyInventoryRecovery(original,plan,{by:'A'});assert.equal(next.containers.length,1);assert.equal(next.containers[0].number,'CA272');
 assert.equal(inventoryRecoveryPlan({equipment:[],containers:[box('only','***')]},['CA001']).ready,false);
});
test('le relevé CA réactive les présents et met au rebut les absents actifs',()=>{
 const original={equipment:[],containers:[box('found','CA025*',{manualArchive:{date:'2025-01-01',comment:'Rebut',by:'A',at:'2025-01-01T00:00:00Z'}}),box('missing','CA026'),box('outside','CB001')]};
 const plan=inventoryRecoveryPlan(original,['CA025']);assert.deepEqual(plan.scrap.map(item=>item.number),['CA026']);
 const next=applyInventoryRecovery(original,plan,{by:'A'});
 assert.equal(containerArchiveInfo(next.containers[0]),null);
 assert.match(next.containers[1].manualArchive.comment,/Absent de l’inventaire CA/);
 assert.equal(next.containers[2].manualArchive,undefined);
});
