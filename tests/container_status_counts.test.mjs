import assert from 'node:assert/strict';
import {containerStatusCounts} from '../containers.mjs';

const today='2026-10-19';
const make=(subtype,interventions)=>({subtype,interventions});
const preventive=date=>({date,type:'préventif'});
const containers=[
 make('PLI AMIENS',[preventive('2026-01-01')]),
 make('PLI AMIENS',[preventive('2025-10-01')]),
 make('CARCASSE',[preventive('2025-04-19')]),
 make('PLI AMIENS',[{date:'2026-10-01',type:'curatif'}]),
 make('PLI AMIENS',[])
];
assert.deepEqual(containerStatusCounts(containers,today),{current:2,overdue:1,unknown:2});
assert.equal(Object.values(containerStatusCounts(containers,today)).reduce((a,b)=>a+b,0),containers.length);
console.log('Compteurs de statut des contenants validés.');
