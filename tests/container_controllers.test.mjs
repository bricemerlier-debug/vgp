import assert from 'node:assert/strict';
import {containerControllerRoster,containerControllerProfilesValid,containerRecordsValid} from '../containers.mjs';

const document={
 controllerProfiles:[{id:'vgp',name:'Contrôleur VGP',email:'vgp@example.test'}],
 verifiers:['Contrôleur VGP'],
 containerControllerProfiles:[{id:'c1',name:'Laurent B.',email:'atelier@example.test'}],
 containers:[{id:'box',number:'CE001',type:'CE',subtype:'PC',interventions:[
  {number:'1',date:'2026-01-01',controller:'laurent b.',type:'préventif',generalState:'',comment:'',parts:{}},
  {number:'2',date:'2026-02-01',controller:'Autre contrôleur',type:'curatif',generalState:'',comment:'',parts:{}},
  {number:'3',date:'2026-03-01',controller:'',type:'curatif',generalState:'',comment:'',parts:{}}
 ]}]
};
const roster=containerControllerRoster(document);
assert.equal(roster.length,2);
assert.ok(!roster.some(profile=>profile.name==='Contrôleur VGP'));
assert.equal(roster.find(profile=>profile.id==='c1').actions.length,1);
assert.equal(roster.find(profile=>profile.id==='c1').email,'atelier@example.test');
assert.equal(roster.find(profile=>profile.name==='Autre contrôleur').last,'2026-02-01');
assert.ok(containerRecordsValid(document));
assert.equal(containerControllerProfilesValid([{id:'1',name:'A',email:''},{id:'2',name:' a ',email:''}]),false);
assert.equal(containerControllerProfilesValid([{id:'1',name:'A',email:'invalide'}]),false);
console.log('Contrôleurs des contenants : séparation VGP, historique et validation OK.');
