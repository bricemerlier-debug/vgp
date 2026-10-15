import {test} from 'node:test';
import assert from 'node:assert/strict';
import {maintenanceActionDeadline as due} from '../maintenance-action-rules.mjs';
test('niveau 1 immédiat, six mois calendaires et fins de mois',()=>{
 assert.equal(due('2026-10-15',1),'2026-10-15');
 assert.equal(due('2026-08-31',2),'2026-12-31');
 assert.equal(due('2027-08-31',2),'2027-12-31');
 assert.equal(due('2025-08-31',2,'2026-01-01'),'2026-02-28');
 assert.equal(due('2027-08-31',2,'2028-01-01'),'2028-02-29');
 assert.equal(due('2026-10-15',2),'2026-12-31');
});
test('niveau 3 conserve l’année de création, même pour un constat antérieur',()=>{
 assert.equal(due('2025-01-01',3,'2026-10-15'),'2026-12-31');
 assert.equal(due('2027-01-01',3,'2026-10-15'),'2026-12-31');
 assert.throws(()=>due('2026-02-31',2));assert.throws(()=>due('2026-10-15',4));
});
