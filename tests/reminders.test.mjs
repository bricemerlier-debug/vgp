import {approved} from './fixtures.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reminders} from '../domain.mjs';
test('jours exacts, fins de mois et délais de 30/14/7 jours',()=>{
 const e=approved({id:'equipment',months:3,controls:[],firstControlDate:'2024-03-31'});
 assert.deepEqual(reminders(e).map(r=>r.date),['2024-03-01','2024-03-17','2024-03-24','2024-03-31']);
 assert.equal(reminders({...e,archived:true}).length,0);
 assert.equal(reminders({controls:[]}).length,0);
});
test('nouveau contrôle recalcule tous les rappels',()=>{
 const e=approved({id:'equipment',months:6,firstControlDate:'2026-01-01',controls:[{date:'2026-09-01',created:1}]});
 assert.deepEqual(reminders(e).map(r=>r.date),['2027-01-30','2027-02-15','2027-02-22','2027-03-01']);
});
