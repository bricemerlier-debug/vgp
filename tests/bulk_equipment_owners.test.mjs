import {test} from 'node:test';
import assert from 'node:assert/strict';
import {associateEquipmentSelection} from '../bulk-equipment-owners.mjs';
const state={owners:['Alice','Bob'],equipment:[{id:'a',owner:'Bob',months:6,controls:[{id:'c'}],archived:true},{id:'b',owner:'Alice'},{id:'c',owner:'',additionalOwners:[]}]};
test('association limitée à la sélection, additive et idempotente',()=>{const before=structuredClone(state),r=associateEquipmentSelection(state,['a','a','b'],'Alice');assert.equal(r.added,1);assert.equal(r.already,1);assert.deepEqual(r.state.equipment[0],{...state.equipment[0],additionalOwners:['Alice']});assert.equal(r.state.equipment[2],state.equipment[2]);assert.deepEqual(state,before);assert.equal(associateEquipmentSelection(r.state,['a','b'],'Alice').added,0);});
test('refuse propriétaire inconnu, équipement supprimé et sélection vide sans modifier',()=>{for(const [ids,owner] of [[['a'],'Unknown'],[['missing'],'Alice'],[[],'Alice']])assert.throws(()=>associateEquipmentSelection(state,ids,owner));assert.equal(state.equipment[0].owner,'Bob');});
