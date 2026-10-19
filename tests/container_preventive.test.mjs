import assert from 'node:assert/strict';
import {containerPreventiveStatus,containerAnnualActivity} from '../containers.mjs';

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
const activity=containerAnnualActivity([
 {id:'c1',number:'TD001',subtype:'CARCASSE - PLAT',interventions:[
  {number:'1',date:'2024-07-10',type:'préventif'},
  {number:'2',date:'2026-01-10',type:'préventif'},
  {number:'3',date:'2026-03-10',type:'correctif'}
 ]},
 {id:'c2',number:'CE048',subtype:'R2 - VERTE',interventions:[
  {number:'4',date:'2025-05-01',type:'préventif'},
  {number:'5',date:'2026-04-01',type:'préventif'}
 ]}
],2026);
assert.equal(activity.length,12);
assert.equal(activity[0].actions.length,1);
assert.equal(activity[0].preventive,1);
assert.equal(activity[2].other,1);
assert.equal(activity[3].preventive,1);
assert.equal(activity[0].due,1); // 18 mois après le contrôle de la carcasse en 2024.
assert.equal(activity[4].due,0); // Le préventif anticipé d’avril remplace l’échéance de mai.
console.log('Échéances préventives et KPI annuels des contenants validés.');
