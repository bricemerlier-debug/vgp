// Diagnostic local : aucune connexion Supabase, aucune écriture de fiches.
import {readSheet as readFile} from 'read-excel-file/node';
import {analyzeApaveActions} from '../apave-actions-import.mjs';
const path=process.argv[2];if(!path)throw Error('Usage : node tools/analyze-apave-actions.mjs fichier.xlsx');
const rows=await readFile(path),today=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Paris'}),report=analyzeApaveActions(rows,[],today);
console.log(JSON.stringify({headerRow:report.headerRow,linesWithGravity:report.items.length,levels:Object.fromEntries([1,2,3].map(level=>[level,report.items.filter(a=>a.level===level).length])),duplicates:report.items.filter(a=>a.duplicate).length,invalid:report.items.filter(a=>a.issue).map(a=>({row:a.sourceRow,identifier:a.identifier,issue:a.issue})),withoutGravity:report.ignored,uniqueActions:report.items.filter(a=>!a.duplicate&&!a.issue).length,examples:report.items.filter(a=>!a.duplicate&&!a.issue).slice(0,5).map(a=>({identifier:a.identifier,level:a.level,date:a.date,dueDate:a.dueDate,observation:a.observation}))},null,2));
