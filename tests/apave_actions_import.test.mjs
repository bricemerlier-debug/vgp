import {test} from 'node:test';import assert from 'node:assert/strict';
import {analyzeApaveActions,apaveActionSourceKey} from '../apave-actions-import.mjs';
const header=['numEquipement','gravite','observation','dateVisite','idRapport'];
const equipment=[{id:'one',identifier:'FF123 / EF456',serialNumber:'123'},{id:'two',identifier:'FF789'}];
test('entête décalée, identifiant exact composé, texte intégral, niveaux et dates',()=>{
 const r=analyzeApaveActions([['titre'],[],header,['FF123',2,'  Réparer.\nNe pas utiliser <x>  ','31/08/2025','R1'],['FF789',3,'Peinture','01/07/2025','R1'],['123',1,'Bloquer','01/07/2025','R1'],['FF123','','Pas une action','01/07/2025','R1']],equipment,'2026-10-15');
 assert.equal(r.headerRow,3);assert.equal(r.items.length,3);assert.equal(r.ignored,1);assert.equal(r.items[0].equipmentId,'one');assert.equal(r.items[0].dueDate,'2026-02-28');assert.equal(r.items[0].observation,'  Réparer.\nNe pas utiliser <x>  ');assert.equal(r.items[1].dueDate,'2026-12-31');assert.equal(r.items[2].dueDate,'2025-07-01');
});
test('ambiguïtés et correspondances absentes, aucun rapprochement partiel ou inventé',()=>{
 const rows=[header,['FF123',2,'réparer','01/07/2026','R'],['FF12',2,'réparer','01/07/2026','R'],['sans plaque',2,'réparer','01/07/2026','R']];
 const r=analyzeApaveActions(rows,[...equipment,{id:'three',identifier:'FF123'}],'2026-10-15');assert.deepEqual(r.items[0].candidates,['one','three']);assert.equal(r.items[0].equipmentId,'');assert.equal(r.items[1].equipmentId,'');assert.equal(r.items[2].equipmentId,'');assert.equal(r.items[2].issue,'');
});
test('doublons stables indépendants du fichier et de l’ordre, données invalides bloquées',async()=>{
 const row=['FF123',2,'réparer','01/07/2026','R1'];const r=analyzeApaveActions([header,row,row,['FF123',4,'réparer','01/07/2026','R'],['FF123',2,'','01/07/2026','R'],['FF123',2,'réparer','31/02/2026','R']],equipment,'2026-10-15');assert.equal(r.items[1].duplicate,true);assert.equal(r.items.filter(a=>a.issue).length,3);assert.equal(await apaveActionSourceKey(r.items[0].identity),await apaveActionSourceKey(r.items[1].identity));
});
