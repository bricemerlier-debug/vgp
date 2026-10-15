// Un seul répertoire ; l’entrée du carnet reste la preuve des travaux réalisés.
export function completedMaintenanceRecord(entry,{id,action_number,title='',level=null,reference='',now=new Date().toISOString()}={}){
 const grade=level===''||level==null?null:Number(level);
 return {id,equipment_id:entry.equipment_id,action_number,title:title.trim()||String(entry.comment||entry.kind).split('\n')[0].trim().slice(0,200)||entry.kind,plan:entry.comment,source:'Manuel',reference,responsible:entry.author,priority:{1:'high',2:'normal',3:'low'}[grade]||'normal',status:'done',level:grade,action_date:entry.date,due_date:null,initial_due_date:null,deferrals:[],completed_entry_id:entry.id,revision:1,created_at:now,updated_at:now};
}
export function maintenanceHistoryRecords(actions,entries){
 const linked=new Set(actions.map(a=>a.completed_entry_id).filter(Boolean));let number=actions.reduce((n,a)=>Math.max(n,a.action_number||0),0);
 return [...entries].sort((a,b)=>String(a.created_at||a.date).localeCompare(String(b.created_at||b.date))||a.id.localeCompare(b.id)).filter(e=>!linked.has(e.id)).map(entry=>completedMaintenanceRecord(entry,{id:crypto.randomUUID(),action_number:++number,title:entry.kind+' · '+entry.date,reference:'Historique du carnet de maintenance',now:entry.created_at||entry.date+'T12:00:00Z'}));
}
