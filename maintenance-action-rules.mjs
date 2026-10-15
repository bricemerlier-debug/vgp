// Délais en dates calendaires, indépendants du fuseau de l’appareil.
export function maintenanceActionDeadline(date,level,creationDate=date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Date de constat invalide.');
 const [y,m,d]=date.split('-').map(Number),value=new Date(Date.UTC(y,m-1,d));
 if(value.toISOString().slice(0,10)!==date)throw Error('Date de constat invalide.');
 if(Number(level)===1)return date;
 if(Number(level)===2){const end=new Date(Date.UTC(y,m+6,0)),target=new Date(Date.UTC(y,m+5,Math.min(d,end.getUTCDate())));return target.toISOString().slice(0,10);}
 if(Number(level)===3)return creationDate.slice(0,4)+'-12-31';
 throw Error('Choisissez un niveau de plan d’action.');
}
