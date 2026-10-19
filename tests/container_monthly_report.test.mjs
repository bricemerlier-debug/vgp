import assert from 'node:assert/strict';
import {containerMonthlyReport} from '../containers.mjs';
const records=[
 {number:'CE1',subtype:'R2 - VERTE',interventions:[{number:'1',date:'2026-01-02'},{number:'2',date:'2026-01-10'},{number:'3',date:'2026-02-02'}]},
 {number:'CE2',subtype:'R2 - VERTE',interventions:[{number:'4',date:'2026-01-30'}]},
 {number:'CE3',subtype:'PC',interventions:[{number:'5',date:'2026-01-02'}]},
 {number:'CE4',subtype:'PC',interventions:[]}
];
assert.deepEqual(containerMonthlyReport(records,2026,1),{
 year:2026,month:1,total:3,interventions:4,groups:[
  {type:'PC',containers:1,interventions:1},
  {type:'R2 - VERTE',containers:2,interventions:3}
 ]
});
assert.equal(containerMonthlyReport(records,2026,2).total,1);
assert.equal(containerMonthlyReport(records,2026,3).total,0);
console.log('Rapport mensuel des contenants validé.');
