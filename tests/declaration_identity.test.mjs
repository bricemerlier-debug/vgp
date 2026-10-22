import {test} from 'node:test';
import assert from 'node:assert/strict';
import {professionalDeclarationIdentity} from '../declaration-identity.mjs';
test('identité issue du mail pro : casse, espaces, prénoms composés',()=>{
 assert.deepEqual(professionalDeclarationIdentity(' Brice_Merlier@Goodyear.com '),{email:'brice_merlier@goodyear.com',name:'Brice Merlier'});
 assert.equal(professionalDeclarationIdentity('jean-pierre_dupont@goodyear.com').name,'Jean-Pierre Dupont');
 for(const value of ['process.team@goodyear.com','brice@gmail.com','brice_merlier@goodyear.com.evil','brice_merlier@goodyear.com\nTo:x',''])assert.throws(()=>professionalDeclarationIdentity(value),/professionnelle/);
});
