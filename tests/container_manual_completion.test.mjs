import assert from 'node:assert/strict';
import test from 'node:test';
import {containerStatusCounts,containerPreventiveStatus,filterContainerList,containerAnnualActivity,containerWeeklyAgenda,containerCategories,containerManuallyCompletedWithoutPeriod} from '../containers.mjs';
const manual={id:'manual',number:'CA033',type:'CA',subtype:'Cartouche',categoryMonths:null,interventions:[]};
const automatic={id:'auto',number:'TR033',type:'TR',subtype:'Tracteur',interventions:[]};
test('le sans-périodicité déclaré manuellement compte comme fait sans inventer de contrôle',()=>{
 assert.equal(containerManuallyCompletedWithoutPeriod(manual),true);
 assert.equal(containerPreventiveStatus(manual,'2026-10-20').status,'exempt');
 assert.deepEqual(containerStatusCounts([manual,automatic],'2026-10-20'),{current:1,overdue:0,unknown:0,exempt:2});
 assert.deepEqual(filterContainerList([manual,automatic],{statuses:['current']},'2026-10-20').map(c=>c.id),['manual']);
 assert.deepEqual(filterContainerList([manual,automatic],{statuses:['exempt']},'2026-10-20').map(c=>c.id),['manual','auto']);
 assert.equal(containerAnnualActivity([manual],2026).reduce((sum,month)=>sum+month.due,0),0);
 assert.equal(containerWeeklyAgenda([manual],'2026-10-20','2026-10-20').total,0);
 assert.equal(containerCategories([manual,automatic],'2026-10-20').find(group=>group.name==='Cartouche').current,1);
 assert.equal(manual.interventions.length,0);
});
