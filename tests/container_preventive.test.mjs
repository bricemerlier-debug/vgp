import assert from 'node:assert/strict';
import {containerPreventiveStatus} from '../containers.mjs';

const today='2026-10-19';
const preventive=(date,type='préventif')=>({date,type});
const container=(subtype,interventions)=>({subtype,interventions});

assert.deepEqual(containerPreventiveStatus(container('CARCASSE - PLAT',[preventive('2025-04-19')]),today),{
 months:18,last:'2025-04-19',due:'2026-10-19',days:0,status:'soon'
});
assert.equal(containerPreventiveStatus(container('PLI AMIENS',[preventive('2025-10-01')]),today).status,'overdue');
assert.equal(containerPreventiveStatus(container('R2 - VERTE',[preventive('2026-02-01'),preventive('2026-08-01'),preventive('2026-09-01','correctif')]),today).due,'2027-08-01');
assert.equal(containerPreventiveStatus(container('CARCASSE - BACHE',[preventive('2024-08-31')]),today).due,'2026-02-28');
assert.equal(containerPreventiveStatus(container('PLI AMIENS',[preventive('2026-01-01','correctif')]),today).status,'unknown');
console.log('Échéances préventives des contenants validées.');
