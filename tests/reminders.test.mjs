import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reminders} from '../domain.mjs';
test('mois calendaire, fins de mois et délais de 14/7 jours',()=>{
 const e={id:'equipment',months:3,controls:[],firstControlDate:'2024-03-31'};
 assert.deepEqual(reminders(e).map(r=>r.date),['2024-02-29','2024-03-17','2024-03-24','2024-03-31']);
 assert.equal(reminders({...e,archived:true}).length,0);
 assert.equal(reminders({controls:[]}).length,0);
});
test('nouveau contrôle recalcule tous les rappels',()=>{
 const e={id:'equipment',months:6,firstControlDate:'2026-01-01',controls:[{date:'2026-09-01',created:1}]};
 assert.deepEqual(reminders(e).map(r=>r.date),['2027-02-01','2027-02-15','2027-02-22','2027-03-01']);
});
