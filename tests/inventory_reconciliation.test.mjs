import assert from 'node:assert/strict';
import test from 'node:test';
import {reconcileInventory} from '../inventory-reconciliation.mjs';
const equipment=[{id:'a',identifier:'CA001',archived:false},{id:'b',identifier:'CA002',archived:false},{id:'c',identifier:'CA003',archived:true},{id:'d',identifier:'CB001',archived:false}];
test('le rapprochement CA est local, borné au préfixe et sans archivage',()=>{
 const before=structuredClone(equipment);
 const result=reconcileInventory(equipment,'ca001\nca003\nca999\nca001\ncb001','CA');
 assert.deepEqual(result.found.map(x=>x.item.id),['a']);
 assert.deepEqual(result.missing.map(x=>x.id),['b']);
 assert.deepEqual(result.archived.map(x=>x.item.id),['c']);
 assert.deepEqual(result.unknown,['CA999']);
 assert.deepEqual(result.outside.map(x=>x.item.id),['d']);
 assert.deepEqual(result.duplicates,['CA001']);
 assert.deepEqual(equipment,before);
});
test('un numéro ambigu ne classe aucune des deux fiches comme retrouvée',()=>{
 const result=reconcileInventory([{id:'a',identifier:'CA-1'},{id:'b',identifier:'CA 1'}],'CA-1','CA');
 assert.equal(result.ambiguous.length,1);assert.equal(result.found.length,0);assert.equal(result.missing.length,0);
});
