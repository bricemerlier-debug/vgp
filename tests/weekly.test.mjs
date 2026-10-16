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
test('perte et rebut restent au jour prévu, sans faux contrôle ni nouvelle échéance après rebut',async()=>{
 const {freezeTracking,declareLoss}=await import('../domain.mjs');let before={equipment:[approved({id:'lost',identifier:'L',designation:'Fixture perte',months:12,controls:[],firstControlDate:'2026-10-14'}),approved({id:'scrap',identifier:'S',designation:'Fixture rebut',months:12,controls:[],firstControlDate:'2026-10-14'})]};before=freezeTracking(structuredClone(before),before,'2026-10-12','Testeur');const next=structuredClone(before);declareLoss(next.equipment[0],{id:'loss',date:'2026-10-15',author:'Testeur',comment:'Recherche fictive',account:'Testeur'});const e=next.equipment[1];e.controls.push({id:'scrap-control',date:'2026-10-15',plannedDate:'2026-10-14',intervenant:'Testeur',result:'Mauvais état — à jeter'});e.archived=true;e.archiveHistory??=[];e.archiveHistory.push({id:'scrap-event',type:'archive',reason:'Mis au rebut',date:'2026-10-15',controlId:'scrap-control'});freezeTracking(next,before,'2026-10-15','Testeur');const raw=structuredClone(next);const entries=weeklySchedule(next.equipment,'2026-10-12')[2].entries;assert.equal(entries.length,2);assert.equal(entries.find(e=>e.equipmentId==='lost').state,'lost');assert.equal(entries.find(e=>e.equipmentId==='lost').done,false);assert.equal(entries.find(e=>e.equipmentId==='scrap').state,'scrapped');assert.equal(weeklySchedule(next.equipment,'2027-10-11').flatMap(d=>d.entries).length,0);assert.equal(equipmentAlerts(next.equipment,'2026-10-15').length,0);assert.deepEqual(next,raw);
});

test('un contrôle fait conserve son avancement mais affiche la situation actuelle perte/rebut',async()=>{
 const {declareLoss,reactivateFound,monthlyProgress}=await import('../domain.mjs');
 const checked=approved({id:'checked',identifier:'FF1',designation:'Anneau',months:12,controls:[{id:'good',date:'2026-10-14',plannedDate:'2026-10-15',result:'Bon état'}],archived:false,archiveHistory:[]});
 const lost=structuredClone(checked);declareLoss(lost,{id:'loss',date:'2026-10-15',author:'Testeur',comment:'Introuvable après le contrôle',account:'Testeur'});
 const scrapped={...structuredClone(checked),archived:true,archiveHistory:[{id:'scrap',type:'archive',reason:'Mis au rebut',date:'2026-10-16'}]};
 for(const [e,state] of [[lost,'lost'],[scrapped,'scrapped']]){const before=structuredClone(e),entry=weeklySchedule([e],'2026-10-12')[3].entries[0];assert.equal(entry.state,state);assert.equal(entry.done,true);assert.equal(monthlyProgress([e],2026,'2026-10-16').months[9].done,1);assert.deepEqual(e,before);}
 reactivateFound(lost,{id:'found',date:'2026-10-16',author:'Testeur',comment:'Retrouvé',account:'Testeur'});assert.equal(weeklySchedule([lost],'2026-10-12')[3].entries[0].state,'done');assert.equal(weeklySchedule([checked],'2026-10-12')[3].entries[0].state,'done');
});
