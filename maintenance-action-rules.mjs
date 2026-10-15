// Délais en dates calendaires, indépendants du fuseau de l’appareil.
export function maintenanceActionDeadline(date,level,creationDate=date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Date de constat invalide.');
 const [y,m,d]=date.split('-').map(Number),value=new Date(Date.UTC(y,m-1,d));
 if(value.toISOString().slice(0,10)!==date)throw Error('Date de constat invalide.');
 if(Number(level)===1)return date;
 if(Number(level)===2){const end=new Date(Date.UTC(y,m+6,0)),target=new Date(Date.UTC(y,m+5,Math.min(d,end.getUTCDate())));const deadline=target.toISOString().slice(0,10),annualEnd=creationDate.slice(0,4)+'-12-31';return deadline<annualEnd?deadline:annualEnd;}
 if(Number(level)===3)return creationDate.slice(0,4)+'-12-31';
 throw Error('Choisissez un niveau de plan d’action.');
}

// Mise à niveau additive du carnet local ; les dates antérieures restent traçables.
export function upgradeMaintenanceAction(action,now=new Date().toISOString()){
 const a={...action,initial_due_date:action.initial_due_date??action.due_date??null,deferrals:action.deferrals||[]};
 const created=a.created_at||a.updated_at,year=created?new Date(created).toLocaleDateString('sv-SE',{timeZone:'Europe/Paris'}).slice(0,4):(a.action_date||now).slice(0,4),end=year+'-12-31';
 if(a.status!=='done'&&[1,2,3].includes(Number(a.level))&&!a.deferrals.length&&a.due_date>end){a.annual_cap_previous_due_date=a.due_date;a.annual_cap_applied_at=now;a.due_date=end;a.revision=(a.revision||0)+1;a.updated_at=now;}
 return a;
}
