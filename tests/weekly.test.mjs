import {approved} from './fixtures.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weekStart,weeklySchedule,equipmentAlerts} from '../domain.mjs';
test('semaine du lundi au dimanche, changement de mois/année',()=>{
 assert.equal(weekStart('2027-01-03'),'2026-12-28');assert.equal(weekStart('2026-10-12'),'2026-10-12');assert.equal(weeklySchedule([],'2026-12-28')[6].date,'2027-01-03');
});
test('échéance puis contrôle réalisé : calendrier conservé, alerte résolue, archives exclues',()=>{
 const e=approved({id:'equipment',identifier:'EQ1',designation:'Anneau',months:12,controls:[],firstControlDate:'2026-10-14'});
 assert.equal(weeklySchedule([e],'2026-10-12')[2].entries[0].done,false);assert.equal(equipmentAlerts([e],'2026-10-12').length,1);
 const done=approved({...e,controls:[{id:'c',date:'2026-10-14',plannedDate:'2026-10-14',created:1}]});
 assert.equal(weeklySchedule([done],'2026-10-12')[2].entries[0].done,true);assert.equal(equipmentAlerts([done],'2026-10-14').length,0);
 assert.equal(equipmentAlerts([{...e,archived:true}],'2026-10-12').length,0);assert.equal(weeklySchedule([{...e,archived:true}],'2026-10-12')[2].entries.length,0);
});
