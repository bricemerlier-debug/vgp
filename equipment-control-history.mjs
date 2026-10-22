// Vue uniquement : les déclarations ne deviennent pas des inspections réglementaires.
export function equipmentControlHistory(e){
 const losses=(e.archiveHistory||[]).filter(a=>['loss-declaration','scrap-declaration'].includes(a.workflow));
 const represented=new Set(losses.flatMap(a=>[a.id,a.originalControlId].filter(Boolean)));
 const controls=(e.controls||[]).filter(c=>!represented.has(c.id)).map(c=>({...c,kind:'control'}));
 const declarations=losses.filter(a=>!e.historyDisplayRemovals?.some(r=>r.eventId===a.id)).map(a=>({...a,kind:a.workflow==='scrap-declaration'?'scrap':'loss',result:a.workflow==='scrap-declaration'?'Mauvais état — à jeter':'Introuvable',intervenant:a.requester,enteredBy:a.account}));
 return [...controls,...declarations].sort((a,b)=>b.date.localeCompare(a.date)||(b.created||0)-(a.created||0)||a.id.localeCompare(b.id));
}
