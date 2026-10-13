import {approved} from './fixtures.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monthlyProgress} from '../domain.mjs';
test('juin 3 sur 4, contrôle réalisé tardivement rattaché à échéance de juin',()=>{
 const completed=i=>approved({id:String(i),identifier:'EQ'+i,designation:'Anneau',months:12,controls:[{id:'c'+i,date:'2026-07-01',plannedDate:'2026-06-20',created:i}]});
 const equipment=[completed(1),completed(2),completed(3),approved({id:'4',identifier:'EQ4',designation:'Anneau',months:12,controls:[],firstControlDate:'2026-06-20'})];
 const m=monthlyProgress(equipment,2026,'2026-10-12').months[5];assert.equal(m.total,4);assert.equal(m.done,3);assert.equal(m.percent,0);assert.equal(m.completionPercent,75);assert.equal(m.late,3);assert.equal(m.remaining,1);assert.equal(m.overdue,1);assert.equal(m.entries.find(e=>!e.done).equipmentId,'4');
 assert.equal(monthlyProgress(equipment,2026,'2026-06-01').months[5].overdue,0);
});
test('archives conservées dans les résultats historiques, échéances inconnues signalées et mois vides sans pourcentage',()=>{
 const data=[approved({id:'a',archived:true,controls:[{plannedDate:'2026-06-01',date:'2026-06-01'}]}), approved({id:'b',controls:[{date:'2026-01-01',created:1}],months:12})];
 const report=monthlyProgress(data,2026,'2026-10-12');assert.equal(report.months[5].percent,100);assert.equal(report.unknownHistory,1);
});
