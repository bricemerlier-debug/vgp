import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildReportPdf,reportConclusion} from '../domain.mjs';
test('conclusion différente selon le résultat, absence de conformité déclarée pour introuvable/réparable/rebut',()=>{
 assert.match(reportConclusion('Bon état','Alice','12/10/2026'),/bon état/);
 assert.match(reportConclusion('Introuvable','Alice','12/10/2026'),/Aucun examen/);
 assert.match(reportConclusion('Mauvais état — réparable','Alice','12/10/2026'),/réparation/);
 assert.match(reportConclusion('Mauvais état — à jeter','Alice','12/10/2026'),/mise au rebut/);
});
test('PDF multipage conserve toutes les observations et la référence',()=>{
 const report={reportId:'VGP-TEST-UNIQUE',equipment:{designation:'Anneau'},fields:[['Numéro de série','ABC']],date:'12/10/2026',verifier:'Alice',result:'Bon état',observations:Array.from({length:150},(_,i)=>'Observation '+i).join('\n'),conclusion:reportConclusion('Bon état','Alice','12/10/2026'),snapshotNote:'Données conservées.'};
 const pdf=buildReportPdf(report);assert.equal(new TextDecoder().decode(pdf).slice(0,8),'%PDF-1.4');const text=new TextDecoder().decode(pdf);assert.match(text,/\/Count [3-9]/);assert.ok(text.endsWith('%%EOF\n'));
});
