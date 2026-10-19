import assert from 'node:assert/strict';
import {filterContainerList,containerStatusCounts} from '../containers.mjs';
const records=[
 {number:'CE1',subtype:'R2 - VERTE',interventions:[{type:'préventif',date:'2026-01-01'}]},
 {number:'CE2',subtype:'R2 - VERTE',interventions:[{type:'préventif',date:'2025-10-01'}]},
 {number:'SE3',subtype:'PC',interventions:[]},
 {number:'CE4',subtype:'R3',interventions:[{type:'préventif',date:'2026-09-01'}]}
];
const today='2026-10-19';
const numbers=options=>filterContainerList(records,options,today).map(c=>c.number);
assert.deepEqual(numbers({types:['R2 - VERTE']}),['CE1','CE2']);
assert.deepEqual(numbers({query:'r2 verte'}),['CE1','CE2']);
assert.deepEqual(containerStatusCounts(filterContainerList(records,{types:['R2 - VERTE']},today),today),{current:1,overdue:1,unknown:0,exempt:0});
assert.deepEqual(numbers({types:['R2 - VERTE','PC'],statuses:['overdue','unknown']}),['CE2','SE3']);
assert.deepEqual(numbers({query:'CE',types:['R2 - VERTE','PC'],statuses:['overdue','unknown']}),['CE2']);
const matching=filterContainerList(records,{types:['R2 - VERTE']},today);
assert.deepEqual(containerStatusCounts(matching,today),{current:1,overdue:1,unknown:0,exempt:0});
assert.deepEqual(filterContainerList(matching,{statuses:['overdue']},today).map(c=>c.number),['CE2']);
console.log('Filtres cumulés des contenants validés.');
