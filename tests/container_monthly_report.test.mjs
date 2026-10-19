import assert from 'node:assert/strict';
import {containerMonthlyReport,containerReportCategory} from '../containers.mjs';
const records=[
 {number:'CE1',subtype:'R2 - VERTE',interventions:[{number:'1',date:'2026-01-02'},{number:'2',date:'2026-01-10'},{number:'3',date:'2026-02-02'}]},
 {number:'CE2',subtype:'R2 - VERTE',interventions:[{number:'4',date:'2026-01-30'}]},
 {number:'CE3',subtype:'PC',interventions:[{number:'5',date:'2026-01-02'}]},
 {number:'CE4',subtype:'PC',interventions:[]}
];
const january=containerMonthlyReport(records,2026,1);
assert.equal(january.total,4);
assert.equal(january.interventions,4);
assert.equal(january.groups.length,12);
assert.deepEqual(january.groups.find(g=>g.type==='Cassettes R2 - VERTE'),{type:'Cassettes R2 - VERTE',actions:3});
assert.deepEqual(january.groups.find(g=>g.type==='PC'),{type:'PC',actions:1});
assert.equal(january.groups.find(g=>g.type==='Divers').actions,0);
assert.equal(containerReportCategory('CARCASSE - BÂCHE'),'Carcasses - BACHE');
assert.equal(containerReportCategory('PLT2'),'Cartouches PLT2');
assert.equal(containerReportCategory('type inconnu'),'Divers');
assert.equal(containerMonthlyReport(records,2026,2).total,1);
assert.equal(containerMonthlyReport(records,2026,3).total,0);
console.log('Rapport mensuel des contenants validé.');
