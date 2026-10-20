import assert from 'node:assert/strict';
import {containerControllerRoster,containerControllerProfilesValid,containerRecordsValid,nextContainerInterventionNumber,containerInterventionControllerValue} from '../containers.mjs';

const document={
 controllerProfiles:[{id:'vgp',name:'Contrôleur VGP',email:'vgp@example.test'}],
 verifiers:['Contrôleur VGP'],
 containerControllerProfiles:[{id:'c1',name:'Laurent B.',email:'atelier@example.test'},{id:'c2',name:'Dylan.P',email:'dylan@example.test'},{id:'c3',name:'Autre',email:''},{id:'c4',name:'Dylan P.',email:''}],
 containers:[{id:'box',number:'CE001',type:'CE',subtype:'PC',interventions:[
  {number:'1',date:'2026-01-01',controller:'laurent b.',type:'préventif',generalState:'',comment:'',parts:{}},
  {number:'2',date:'2026-02-01',controller:'Autre contrôleur',type:'curatif',generalState:'',comment:'',parts:{}},
  {number:'3',date:'2026-03-01',controller:'',type:'curatif',generalState:'',comment:'',parts:{}},
  {number:'4',date:'2026-04-01',controller:'Laurent B. / Stéphane G.',type:'préventif',generalState:'',comment:'',parts:{}},
  {number:'5',date:'2026-05-01',controller:'Laurent B. / Autre',type:'curatif',generalState:'',comment:'',parts:{}},
  {number:'6',date:'2026-06-01',controller:'Dylan P.',type:'curatif',generalState:'',comment:'',parts:{}},
  {number:'7',date:'2026-07-01',controller:'Dylan.P',type:'curatif',generalState:'',comment:'',parts:{}},
  {number:'8',date:'2026-08-01',controller:'Laurent.B / Laurent B.',type:'curatif',generalState:'',comment:'',parts:{}},
  {number:'9',date:'2026-09-01',controller:'Stéphane G. / Autre',type:'curatif',generalState:'',comment:'',parts:{}},
  {number:'10',date:'2026-10-01',controller:'Autre',type:'curatif',generalState:'',comment:'',parts:{}}
 ]}]
};
const roster=containerControllerRoster(document);
assert.equal(roster.length,4);
assert.ok(!roster.some(profile=>profile.name==='Contrôleur VGP'));
assert.ok(!roster.some(profile=>/^autre/i.test(profile.name)));
assert.equal(roster.find(profile=>profile.name==='Laurent B.').actions.length,4);
assert.equal(roster.find(profile=>profile.name==='Stéphane G.').actions.length,2);
assert.equal(roster.find(profile=>profile.name==='Dylan P.').actions.length,2);
assert.equal(roster.find(profile=>profile.name==='Friedlander').actions.length,3);
assert.equal(roster.find(profile=>profile.id==='c1').email,'atelier@example.test');
assert.equal(roster.find(profile=>profile.name==='Dylan P.').email,'dylan@example.test');
assert.ok(roster.find(profile=>profile.name==='Laurent B.').actions.some(action=>action.intervention.number==='4'));
assert.ok(roster.find(profile=>profile.name==='Stéphane G.').actions.some(action=>action.intervention.number==='4'));
assert.ok(containerRecordsValid(document));
assert.equal(containerInterventionControllerValue('Laurent B.','Stéphane G.'),'Laurent B. / Stéphane G.');
assert.equal(containerInterventionControllerValue('Laurent B.','laurent.b.'),'Laurent B.');
assert.equal(containerInterventionControllerValue('Laurent B.',''),'Laurent B.');
assert.equal(containerControllerProfilesValid([{id:'1',name:'A',email:''},{id:'2',name:' a ',email:''}]),false);
assert.equal(containerControllerProfilesValid([{id:'1',name:'A',email:'invalide'}]),false);
assert.equal(nextContainerInterventionNumber(document.containers),'11');
assert.equal(nextContainerInterventionNumber([{interventions:[{number:'I-1'},{number:'002'}]}]),'3');
assert.equal(nextContainerInterventionNumber([]),'1');
const afterControllerCleanup={...document,containerControllerProfiles:document.containerControllerProfiles.filter(profile=>profile.name!=='Autre')};
assert.equal(containerControllerRoster(afterControllerCleanup).find(profile=>profile.name==='Friedlander').actions.length,3);
console.log('Contrôleurs des contenants : séparation VGP, historique et validation OK.');
