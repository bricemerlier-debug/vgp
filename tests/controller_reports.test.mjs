import test from 'node:test';
import assert from 'node:assert/strict';
import {controllerReportEntries} from '../controllers.mjs';

test('la fiche contrôleur regroupe vérifications, introuvables et destructions avec rapport',()=>{
 const profile={id:'v1',name:'Stéphane G.',email:''},other={id:'v2',name:'Laurent B.',email:''};
 const equipment={id:'e1',controls:[
  {id:'c1',date:'2026-10-10',reportId:'10',intervenant:'Stéphane G.',verifierId:'v1',result:'Bon état',created:1},
  {id:'c2',date:'2026-10-11',reportId:'11',intervenant:'Stéphane G.',verifierId:'v1',result:'Mauvais état — à jeter',created:2},
  {id:'c3',date:'2026-10-12',reportId:'12',intervenant:'Laurent B.',verifierId:'v2',result:'Introuvable',created:3},
  {id:'legacy',date:'2026-10-09',intervenant:'Ancien nom',result:'Bon état',created:0}
 ],archiveHistory:[
  {id:'a1',date:'2026-10-13',type:'archive',reason:'Équipement perdu',workflow:'loss-declaration',verifierId:'v1',requester:'Stéphane G.',reportId:'13',created:4},
  {id:'a2',date:'2026-10-14',type:'archive',reason:'Mis au rebut',controlId:'c2',requester:'Opérateur',signedAttachment:{name:'destruction.pdf'},created:5},
  {id:'a3',date:'2026-10-15',type:'archive',reason:'Mis au rebut',workflow:'memoryflow-archive',requester:'Stéphane G.',created:6}
 ]};
 const state={controllerProfiles:[profile,other],controllerOrigins:{legacy:'v1'},equipment:[equipment]};
 const entries=controllerReportEntries(state,profile);
 assert.deepEqual(entries.map(entry=>entry.record.id),['a2','a1','c2','c1','legacy']);
 assert.deepEqual(entries.map(entry=>entry.label),['Destruction / mise au rebut','Déclaration d’introuvable','Contrôle · mise au rebut','Bon état','Bon état']);
 assert.equal(controllerReportEntries({controllerProfiles:[profile,other],equipment:[equipment]},other).length,1);
});
