import {test} from 'node:test';
import assert from 'node:assert/strict';
import {indicators} from '../domain.mjs';
test('historique distinct de la couverture actuelle, indépendance du résultat',()=>{
 const equipment=[
 {months:3,controls:[{date:'2026-01-01',created:1},{date:'2026-07-12',created:2,result:'Introuvable'}]},
 {months:3,controls:[{date:'2026-01-01',created:1}]},
 {months:3,controls:[]},
 {months:12,controls:[{date:'2026-09-01',created:1,result:'Mauvais état — à jeter'}]}];
 assert.deepEqual(indicators(equipment,'2026-10-12'),{total:4,performed:4,actions:4,covered:2,missing:1,overdue:1,toDo:2,percent:50});
});
test('parc vide : pourcentage absent ; parc sans contrôle : zéro pour cent',()=>{
 assert.equal(indicators([],'2026-10-12').percent,null);
 assert.equal(indicators([{months:3,controls:[]}],'2026-10-12').percent,0);
 assert.equal(indicators([{months:3,controls:[]}],'2026-10-12').toDo,1);
});
test('archives exclues du suivi actuel, historique préservé',()=>{
 const equipment=[{archived:true,months:3,controls:[{date:'2026-01-01',created:1}]},{months:3,controls:[]}];
 assert.deepEqual(indicators(equipment,'2026-10-12'),{total:1,performed:1,actions:1,covered:0,missing:1,overdue:0,toDo:1,percent:0});
});
test('première échéance sans contrôle ne compte pas comme contrôle réalisé',()=>{
 const equipment=[{months:12,firstControlDate:'2026-10-12',controls:[]}];
 assert.equal(indicators(equipment,'2026-10-12').percent,0);
 assert.equal(indicators(equipment,'2026-10-13').toDo,1);
 assert.equal(indicators(equipment,'2026-10-13').performed,0);
});
