import assert from 'node:assert/strict';
import {containerCategorySettings,containerCategorySettingsValid,containerPreventiveStatus,containerWeeklyAgenda,containerAnnualActivity,containerRecordsValid,containerInterventionReport} from '../containers.mjs';

const intervention={number:'I-1',date:'2026-01-15',type:'préventif',controller:'Marie',generalState:'Bon',comment:'RAS',parts:{Frein:'OK','Éclairage':'À réparer'}};
const container={id:'a',number:'TA001',type:'TA',subtype:'CARCASSE - BACHE',interventions:[intervention]};
assert.equal(containerCategorySettings(container).months,18);
assert.equal(containerPreventiveStatus(container,'2027-01-16').due,'2027-07-15');
const configured={...container,categoryMonths:6,categoryChecks:['Frein','Éclairage']};
assert.deepEqual(containerCategorySettings(configured),{months:6,checks:['Frein','Éclairage']});
assert.equal(containerPreventiveStatus(configured,'2026-07-15').due,'2026-07-15');
assert.equal(containerWeeklyAgenda([configured],'2026-07-15','2026-07-15').total,1);
assert.equal(containerAnnualActivity([configured],2026)[6].due,1);
const exempt={...configured,categoryMonths:null};
assert.equal(containerPreventiveStatus(exempt,'2026-07-15').status,'exempt');
assert.equal(containerWeeklyAgenda([exempt],'2026-07-15','2026-07-15').total,0);
assert.equal(containerAnnualActivity([exempt],2026)[6].due,0);
for(const type of ['TR','TP','TJ','TG','SA','TF','TI','TK','TM','TN']){
 const withoutPeriod={...configured,type,categoryMonths:6};
 assert.equal(containerCategorySettings(withoutPeriod).months,null,`${type} must not inherit a category periodicity`);
 assert.equal(containerPreventiveStatus(withoutPeriod,'2026-07-15').status,'exempt');
 assert.equal(containerWeeklyAgenda([withoutPeriod],'2026-07-15','2026-07-15').total,0);
 assert.equal(containerAnnualActivity([withoutPeriod],2026)[6].due,0);
}
assert.match(containerInterventionReport(configured,intervention).observations,/Éclairage : À réparer/);
assert.ok(containerRecordsValid({containers:[configured]}));
assert.ok(!containerCategorySettingsValid({...configured,categoryMonths:121}));
assert.ok(!containerCategorySettingsValid({...configured,categoryChecks:['Frein','frein']}));
console.log('container category settings OK');
