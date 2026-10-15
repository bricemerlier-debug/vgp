// Private documents and their expected observations must remain outside the public repository.
// node tests/apave_reference.mjs /private/report.pdf /private/expected.json [/tmp/proof.json]
import fs from 'node:fs';import assert from 'node:assert/strict';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {extractApavePdf,matchApaveRecords} from '../apave.mjs';
if(!process.argv[2]||!process.argv[3])throw Error('Indiquez le PDF et les attentes privées. Aucune connexion Supabase.');
const expected=JSON.parse(fs.readFileSync(process.argv[3])),report=await extractApavePdf(fs.readFileSync(process.argv[2]),pdfjs);
assert.equal(report.pageCount,expected.pageCount);assert.equal(report.reportNumber,expected.reportNumber);assert.equal(report.records.length,expected.totalEntries);assert.equal(new Set(report.records.map(r=>r.sourceKey)).size,report.records.length);
const equipment=expected.equipment.map(target=>{const actual=report.records.find(r=>r.sourceKey===target.sourceKey);assert.deepEqual(actual,target);return actual;});
const gear=equipment.map((r,i)=>({id:'fictif-'+i,identifier:r.identifiers.find(i=>/^(?:FF|EF)\d+$/.test(i.value))?.value||r.identifiers[0].value,serialNumber:''}));const matches=matchApaveRecords(report.records,gear);assert.equal(matches.filter(r=>r.equipmentId).length,gear.length);
const proof={reportNumber:report.reportNumber,pageCount:report.pageCount,totalEntries:report.records.length,states:Object.fromEntries(['verified','partial','not_verified','unknown'].map(s=>[s,report.records.filter(r=>r.state===s).length])),equipment,supabaseWrites:0,externalServiceCalls:0};if(process.argv[4])fs.writeFileSync(process.argv[4],JSON.stringify(proof,null,2));console.log(`PASS rapport réel : ${report.pageCount} pages / ${report.records.length} entrées ; ${equipment.length} équipements, dates, pages, observations exactes ; aucune écriture Supabase.`);
