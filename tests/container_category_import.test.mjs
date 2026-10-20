import assert from 'node:assert/strict';
import {planContainerCategoryImport,analyzeContainerCategoryFiles} from '../container-import.mjs';
import {containerRecordsValid,containerCategories} from '../containers.mjs';

const history=[{number:'I-1',date:'2026-09-30',type:'préventif',controller:'Marie',generalState:'Bon',comment:'Contrôle fait',parts:{}}];
const existing=[
 {id:'a',number:'SE101',type:'SE',subtype:'Ancienne',categoryMonths:12,categoryChecks:['Frein'],interventions:history},
 {id:'b',number:'CC202',type:'CC',subtype:'R2 - JAUNE',categoryMonths:6,categoryChecks:['Roue'],interventions:[]},
 {id:'c',number:'TD303',type:'TD',subtype:'Ancienne',interventions:[]},
];
const rows=[
 {number:'SE101',subcategory:'CC',category:'R2 - JAUNE',line:2},
 {number:'SE101',subcategory:'CC',category:'R2 - JAUNE',line:3},
 {number:'TD303',subcategory:'TD',category:'CARCASSE - PLAT',line:4},
 {number:'INCONNU',subcategory:'CE',category:'R2 - VERTE',line:5},
];
const plan=planContainerCategoryImport(rows,existing);
assert.equal(plan.changes.length,2);
assert.equal(plan.issues.length,1);
assert.deepEqual(plan.categories,[{category:'CARCASSE - PLAT',subcategory:'TD'},{category:'R2 - JAUNE',subcategory:'CC'}]);
assert.equal(plan.containers[0].number,'SE101');
assert.equal(plan.containers[0].type,'CC');
assert.equal(plan.containers[0].subtype,'R2 - JAUNE');
assert.deepEqual(plan.containers[0].interventions,history);
assert.equal(plan.containers[0].categoryMonths,6);
assert.deepEqual(plan.containers[0].categoryChecks,['Roue']);
assert.equal(plan.containers[2].categoryMonths,undefined);
assert.equal(existing[0].type,'SE');
assert.ok(containerRecordsValid({containers:plan.containers}));
assert.equal(containerCategories(plan.containers).find(group=>group.name==='R2 - JAUNE').containers.length,2);
const conflict=planContainerCategoryImport([...rows,{number:'SE101',subcategory:'SE',category:'PC',line:6}],existing);
assert.equal(conflict.containers[0].type,'SE');
assert.ok(conflict.issues.some(issue=>issue.reason.includes('Valeurs différentes')));
const original=globalThis.VGPReadExcel;
globalThis.VGPReadExcel=async()=>[['N° d’intervention','# équipement','Date','Type','Type1'],['I-1','SE101','30/09/2026','CC','R2 - JAUNE']];
try{
 const file={name:'categories.xlsx',size:100};
 const parsed=await analyzeContainerCategoryFiles([file],existing);
 assert.equal(parsed.changes.length,1);
 assert.equal(parsed.changes[0].subcategory,'CC');
}finally{globalThis.VGPReadExcel=original;}
console.log('container category import OK');
