import assert from 'node:assert/strict';
import {sortContainerList} from '../containers.mjs';

const records=[
 {number:'CE10',subtype:'Z',interventions:[{date:'2026-01-02',type:'préventif'},{date:'2026-10-01',type:'correctif'}]},
 {number:'CE2',subtype:'A',interventions:[{date:'2026-09-01',type:'préventif'}]},
 {number:'CE1',subtype:'A',interventions:[]}
];
const numbers=(key,direction)=>sortContainerList(records,key,direction).map(c=>c.number);
assert.deepEqual(numbers('number','asc'),['CE1','CE2','CE10']);
assert.deepEqual(numbers('number','desc'),['CE10','CE2','CE1']);
assert.deepEqual(numbers('subtype','asc'),['CE1','CE2','CE10']);
assert.deepEqual(numbers('count','desc'),['CE10','CE2','CE1']);
assert.deepEqual(numbers('last','desc'),['CE10','CE2','CE1']);
assert.deepEqual(numbers('due','asc'),['CE10','CE2','CE1']);
assert.deepEqual(numbers('due','desc'),['CE2','CE10','CE1']);
assert.equal(records[0].number,'CE10');
console.log('Tri des contenants validé.');
