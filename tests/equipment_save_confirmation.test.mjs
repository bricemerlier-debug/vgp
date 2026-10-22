import {test} from 'node:test';
import assert from 'node:assert/strict';
import {equipmentSaveConfirmed} from '../equipment-save-confirmation.mjs';

test('une réponse perdue est confirmée seulement si la révision et la fiche correspondent',()=>{
 const expected={equipment:[{id:'new',identifier:'FF001',owner:'Process Team B2',controls:[]}]};
 const persisted=structuredClone(expected);
 assert.equal(equipmentSaveConfirmed(expected,persisted,'new',18,19),true);
 assert.equal(equipmentSaveConfirmed(expected,persisted,'new',18,18),false);
 assert.equal(equipmentSaveConfirmed(expected,{equipment:[]},'new',18,19),false);
 persisted.equipment[0].owner='Autre équipe';
 assert.equal(equipmentSaveConfirmed(expected,persisted,'new',18,19),false);
});
