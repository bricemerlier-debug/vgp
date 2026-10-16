export function maintenanceActionVisual(action,today){
 if(action.status==='done')return {key:'done',label:'Réalisée'};
 if(!action.due_date)return {key:'unknown',label:'Échéance à définir'};
 if(action.due_date<today)return {key:'late',label:'En retard'};
 if(action.deferrals?.length)return {key:'deferred',label:'Reportée'};
 return {key:'todo',label:'À faire'};
}
export function maintenanceWeek(date,offset=0){
 const current=new Date(date+'T12:00:00Z');current.setUTCDate(current.getUTCDate()-((current.getUTCDay()+6)%7)+offset*7);
 return Array.from({length:7},(_,i)=>{const d=new Date(current);d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10);});
}
export function selectMaintenanceActions(actions,equipment,filters={}){
 const map=new Map(equipment.map(e=>[e.id,e])),norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
 return actions.filter(a=>{const e=map.get(a.equipment_id)||{},q=norm(filters.search||'');return(!q||norm(['PA-'+a.action_number,a.title,a.plan,a.reference,a.responsible,e.identifier,e.designation,e.equipmentMark,e.serialNumber,e.location,e.sector,e.zone,e.team].join(' ')).includes(q))&&['sector','zone','team'].every(key=>!filters[key]||(e[key]||'Non renseigné')===filters[key])&&(!filters.level||String(a.level||'unclassified')===filters.level)&&(!filters.responsible||(a.responsible||'À attribuer')===filters.responsible)&&(!filters.source||a.source===filters.source);});
}
