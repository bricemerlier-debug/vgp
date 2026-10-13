import {approved} from './fixtures.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addMonths,due,status} from '../domain.mjs';
test('fin de mois et année bissextile',()=>{assert.equal(addMonths('2023-11-30',3),'2024-02-29');assert.equal(addMonths('2024-08-31',6),'2025-02-28');assert.equal(addMonths('2024-02-29',12),'2025-02-28')});
test('échéance indépendante du résultat et basée sur la date la plus récente',()=>{const e=approved({months:3,controls:[{date:'2026-04-01',result:'Mauvais état — à jeter',created:2},{date:'2026-01-01',result:'Bon état',created:3}]});assert.equal(due(e),'2026-07-01');assert.equal(status(e,'2026-07-01',0),'À faire');assert.equal(status(e,'2026-07-02',30),'En retard');assert.equal(status(e,'2026-05-01',30),'Échéance à plus d’un mois');assert.equal(status({controls:[]},'2026-01-01',30),'Situation à vérifier')});
test('première échéance explicitement justifiée jusqu’à un mois calendaire avant, puis à faire et en retard',()=>{
 const e=approved({months:12,controls:[],firstControlDate:'2027-10-12'});
 assert.equal(status(e,'2026-10-12'),'Échéance à plus d’un mois');assert.equal(status(e,'2027-09-11'),'Échéance à plus d’un mois');assert.equal(status(e,'2027-09-12'),'À faire');assert.equal(status(e,'2027-10-12'),'À faire');assert.equal(status(e,'2027-10-13'),'En retard');
 assert.equal(status(approved({controls:[],firstControlDate:'2027-03-31'}),'2027-02-27'),'Échéance à plus d’un mois');assert.equal(status(approved({controls:[],firstControlDate:'2027-03-31'}),'2027-02-28'),'À faire');
});
