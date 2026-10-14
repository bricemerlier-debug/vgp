import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDigest,digestSchedule} from '../digest.mjs';
const gear=(identifier,date,sector='',extra={})=>({id:identifier,identifier,designation:'Équipement fictif '+identifier,sector,team:'A',months:12,controls:[],...(date?{manualNextControlDate:date,manualControlId:null,dateValidation:{validated:true,reason:'Test fictif',source:'Fixture',by:'Testeur'}}:{}),...extra});
test('bilan sectorisé : retards prioritaires, limites incluses, aucune fausse réalisation',()=>{
 const source={equipment:[gear('retard','2026-10-13','B2'),gear('lundi','2026-10-12','A1'),gear('dimanche','2026-10-18','B2'),gear('apres','2026-10-19','A1'),gear('inconnu',null),gear('perdu','2026-10-15','B2',{archived:true,archiveHistory:[{type:'archive',reason:'Équipement perdu'}]}),gear('rebut','2026-10-16','A1',{archived:true,archiveHistory:[{type:'archive',reason:'Mis au rebut'}]})]},before=structuredClone(source),r=buildDigest(source,'week','2026-10-14');
 assert.equal(r.start,'2026-10-12');assert.equal(r.end,'2026-10-18');assert.deepEqual(r.counts,{active:5,overdue:2,planned:1,unknown:1});assert.ok(r.text.includes('B2 — 2 équipement(s)'));assert.ok(!r.text.includes('n° interne apres'));assert.ok(!r.text.includes('n° interne perdu'));assert.ok(r.text.indexOf('n° interne retard')<r.text.indexOf('n° interne dimanche'));assert.equal(r.monthlyProgress.done,0);assert.deepEqual(source,before);
});
test('mois bissextile, décembre et jours de déclenchement',()=>{
 assert.equal(buildDigest({equipment:[]},'month','2024-02-01').end,'2024-02-29');assert.equal(buildDigest({equipment:[]},'month','2026-12-01').end,'2026-12-31');assert.deepEqual(digestSchedule('2026-06-01'),{week:true,month:true});assert.deepEqual(digestSchedule('2026-10-14'),{week:false,month:false});assert.match(buildDigest({equipment:[]},'week','2026-10-14').text,/non applicable/);
});
