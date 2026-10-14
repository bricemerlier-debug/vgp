import {due,addMonths,equipmentName,isInspection} from './domain.mjs';
// Lecture seule : les dates estimées ne deviennent jamais des contrôles ou des rapports.
export function historicalActivity(equipment,year,today){
 const months=Array.from({length:12},(_,i)=>({month:i+1,real:0,declared:0,estimated:0,total:0,entries:[]}));
 for(const e of equipment){
  const dates=new Map();
  for(const c of e.controls||[])if(isInspection(c)&&c.date<=today)dates.set('control:'+c.id,{date:c.date,kind:'real',source:'Contrôle enregistré',equipmentId:e.id,identifier:e.identifier,name:equipmentName(e)});
  for(const t of [e.memoryFlowTracking,...(e.memoryFlowTrackingHistory||[])].filter(Boolean))if(t.lastDate&&t.lastDate<=today&&![...dates.values()].some(entry=>entry.date===t.lastDate))dates.set(t.lastDate,{date:t.lastDate,kind:'declared',source:'Date déclarée dans MemoryFlow — résultat et vérificateur inconnus',equipmentId:e.id,identifier:e.identifier,name:equipmentName(e)});
  const deadline=!e.archived?due(e):null;
  if(!dates.size&&deadline&&deadline>=today&&[3,6,9,12].includes(e.months)){const date=addMonths(deadline,-e.months);if(date<=today)dates.set(date,{date,kind:'estimated',source:`Estimation : échéance ${deadline} moins ${e.months} mois — réalisation non confirmée`,equipmentId:e.id,identifier:e.identifier,name:equipmentName(e)});}
  for(const entry of dates.values())if(Number(entry.date.slice(0,4))===year){const m=months[Number(entry.date.slice(5,7))-1];if(!m)continue;m.entries.push(entry);m[entry.kind]++;m.total++;}
 }
 for(const m of months)m.entries.sort((a,b)=>a.date.localeCompare(b.date)||a.identifier.localeCompare(b.identifier,'fr',{numeric:true}));
 return {months,total:months.reduce((n,m)=>n+m.total,0)};
}
