import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addMonths,due,status} from '../domain.mjs';
test('fin de mois et année bissextile',()=>{assert.equal(addMonths('2023-11-30',3),'2024-02-29');assert.equal(addMonths('2024-08-31',6),'2025-02-28');assert.equal(addMonths('2024-02-29',12),'2025-02-28')});
test('échéance indépendante du résultat et basée sur la date la plus récente',()=>{const e={months:3,controls:[{date:'2026-04-01',result:'Mauvais état — à jeter',created:2},{date:'2026-01-01',result:'Bon état',created:3}]};assert.equal(due(e),'2026-07-01');assert.equal(status(e,'2026-07-01',0),'À venir');assert.equal(status(e,'2026-07-02',30),'En retard');assert.equal(status(e,'2026-05-01',30),'Planifié');assert.equal(status({controls:[]},'2026-01-01',30),'À définir')});
