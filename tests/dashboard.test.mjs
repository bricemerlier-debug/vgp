import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dashboard} from '../domain.mjs';
test('couverture par équipement, archives exclues, résultats et échéances distincts',()=>{
 const e=[{sector:'B2',months:3,controls:[{date:'2026-01-01',created:1,result:'Bon état'},{date:'2026-06-01',created:2,result:'Introuvable'}]},
 {sector:'B2',months:3,controls:[{date:'2026-07-20',created:1,result:'Mauvais état — réparable'}]},
 {sector:'A1',months:12,controls:[{date:'2026-10-01',created:1,result:'Bon état'}]},
 {sector:'',months:3,firstControlDate:'2026-10-01',controls:[]},
 {archived:true,sector:'A1',months:3,controls:[{date:'2026-06-01',created:1,result:'Mauvais état — à jeter'}]}];
 const k=dashboard(e,'2026-10-12',30);
 assert.equal(k.total,4);assert.equal(k.controlled,3);assert.equal(k.percent,75);assert.equal(k.missing,1);assert.equal(k.archived,1);assert.equal(k.performed,5);
 assert.deepEqual([k.missing,k.overdue,k.soon,k.planned],[1,2,1,1]);
 assert.deepEqual(k.results.map(r=>r.count),[1,1,0,1]);
 assert.deepEqual(k.sectors.find(s=>s.sector==='B2'),{sector:'B2',total:2,controlled:2});
 assert.deepEqual(k.sectors.find(s=>s.sector===''),{sector:'',total:1,controlled:0});
});
test('aucun actif ne donne pas un pourcentage inventé',()=>{assert.equal(dashboard([],'2026-10-12',30).percent,null);assert.equal(dashboard([{archived:true,controls:[]}],'2026-10-12',30).percent,null)});
