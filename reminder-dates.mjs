// Une seule règle de dates civiles. Les heures et les changements d'heure n'affectent pas J-n.
export const reminderStages=Object.freeze([{kind:'month',stage:30,label:'J-30 · 30 jours avant'},{kind:'twoWeeks',stage:14,label:'J-14 · 14 jours avant'},{kind:'week',stage:7,label:'J-7 · 7 jours avant'},{kind:'deadline',stage:0,label:'J0 · Jour de l’échéance'}]);
export function reminderCivilDate(instant=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(instant));}
export function reminderDates(deadline){if(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)||!Number.isFinite(Date.parse(deadline+'T12:00:00Z'))||new Date(deadline+'T12:00:00Z').toISOString().slice(0,10)!==deadline)throw Error('Échéance invalide');return reminderStages.map(s=>{const date=new Date(deadline+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-s.stage);return {...s,date:date.toISOString().slice(0,10),deadline};});}

// Une seule relance courante, sans génération des semaines déjà passées.
export function overdueReminderDate(deadline,onDate){
 reminderDates(deadline);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(onDate)||!Number.isFinite(Date.parse(onDate+'T12:00:00Z'))||new Date(onDate+'T12:00:00Z').toISOString().slice(0,10)!==onDate)throw Error('Date de relance invalide');
 const days=(Date.parse(onDate+'T12:00:00Z')-Date.parse(deadline+'T12:00:00Z'))/86400000;
 return days>=7&&days%7===0?{kind:'overdue',stage:-days,label:'Contrôle en retard',date:onDate,deadline}:null;
}
