import {test} from 'node:test';import assert from 'node:assert/strict';import {upgradeControllers,controllersValid,controlBelongsToController,activeControllers} from '../controllers.mjs';
test('legacy names migrate to profiles without altering inspection history',()=>{const old={id:'c',intervenant:'Alice',date:'2026-10-01'},d={verifiers:['Alice','alice'],equipment:[{controls:[old]}]};let n=0;upgradeControllers(d,()=>String(++n));assert.equal(d.controllerProfiles.length,1);assert.deepEqual(d.equipment[0].controls,[old]);assert(controllersValid(d));const p=d.controllerProfiles[0];p.name='Alice corrigée';p.aliases=['Alice'];upgradeControllers(d,()=>String(++n));assert.equal(d.controllerProfiles.length,1);assert.equal(d.verifiers[0],'Alice corrigée');assert(controlBelongsToController(old,p));assert(controlBelongsToController({verifierId:p.id,intervenant:'Ancien libellé'},p));assert(!controlBelongsToController({verifierId:'autre',intervenant:p.name},p));});
test('profiles reject duplicate names, invalid signatures and orphaned verifier IDs',()=>{const d={equipment:[{controls:[]}],controllerProfiles:[{id:'1',name:'Alice',email:'alice@example.com',signature:null}]};assert(controllersValid(d));const bad=structuredClone(d);bad.controllerProfiles.push({id:'2',name:' ALICE ',email:'',signature:null});assert(!controllersValid(bad));const remote=structuredClone(d);remote.controllerProfiles[0].signature={name:'x',type:'image/png',url:'https://example.com/image.png'};assert(!controllersValid(remote));const orphan=structuredClone(d);orphan.equipment[0].controls.push({verifierId:'absent'});assert(!controllersValid(orphan));});

test('Autre controls are shown on Friedlander and combined histories on each individual profile',()=>{
  const profile=(id,name)=>({id,name,email:'',signature:null});
  const controls=[
    {id:'c1',verifierId:'other',intervenant:'Autre',date:'2026-01-01'},
    {id:'c2',verifierId:'laurent-other',intervenant:'Laurent B. / Autre',date:'2026-01-02'},
    {id:'c3',verifierId:'stephane-laurent',intervenant:'Stéphane G. / Laurent B.',date:'2026-01-03'}
  ];
  const state={verifiers:['Autre','Laurent B. / Autre'],controllerProfiles:[
    profile('other','Autre'),profile('laurent','Laurent B.'),profile('stephane','Stéphane G.'),
    profile('laurent-other','Laurent B. / Autre'),profile('stephane-laurent','Stéphane G. / Laurent B.')
  ],equipment:[{controls}]};
  const original=structuredClone(controls);
  let id=0;
  upgradeControllers(state,()=>String(++id));
  const profiles=state.controllerProfiles;
  const find=name=>profiles.find(profile=>profile.name===name);
  const friedlander=find('Friedlander'),laurent=find('Laurent B.'),stephane=find('Stéphane G.');
  assert(friedlander&&laurent&&stephane);
  assert(!activeControllers(profiles).some(profile=>profile.name==='Autre'||profile.name==='Laurent B. / Autre'||profile.name==='Stéphane G. / Laurent B.'));
  assert(!state.verifiers.includes('Autre'));
  assert.deepEqual(state.equipment[0].controls,original);
  assert.deepEqual(controls.filter(control=>controlBelongsToController(control,friedlander,profiles)).map(control=>control.id),['c1','c2']);
  assert.deepEqual(controls.filter(control=>controlBelongsToController(control,laurent,profiles)).map(control=>control.id),['c2','c3']);
  assert.deepEqual(controls.filter(control=>controlBelongsToController(control,stephane,profiles)).map(control=>control.id),['c3']);
  assert(controllersValid(state));
});
