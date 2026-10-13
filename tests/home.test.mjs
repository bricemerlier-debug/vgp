import {approved} from './fixtures.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {homeSummary} from '../domain.mjs';
const gear=(id,date,controls=[])=>approved({id,identifier:id,designation:'Anneau '+id,months:12,firstControlDate:date,controls,archived:false});
test('objectif mensuel 3/4, retards et dates manquantes distincts, archives exclues',()=>{
 const completed=[1,2,3].map(n=>gear('done'+n,null,[{date:'2026-06-01',created:n,plannedDate:'2026-06-01',result:n===1?'Mauvais état — réparable':'Bon état'}]));
 const h=homeSummary([...completed,gear('late','2026-06-04'),gear('week','2026-07-01'),gear('undefined',null),{...gear('archive','2026-05-05'),archived:true}],'2026-06-25');
 assert.equal(h.current.percent,75);assert.equal(h.current.done,3);assert.equal(h.current.remaining,1);assert.deepEqual(h.overdue.map(e=>e.id),['late']);assert.deepEqual(h.week.map(e=>e.id),['week']);assert.equal(h.undefinedDates.length,1);assert.equal(h.activeCount,6);assert.equal(h.issues.length,1);
});
test('neuf sans contrôle : planifié sans réalisation inventée ; aucun planning ne vaut pas 100 %',()=>{
 const h=homeSummary([gear('new','2027-06-01')],'2026-06-01');assert.equal(h.current.percent,null);assert.equal(h.current.done,0);assert.equal(h.priorities.length,0);assert.equal(h.issues.length,0);
});
