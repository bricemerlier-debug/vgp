import {equipmentOwners} from './ownership.mjs';
import {SHIFT_TEAMS,shiftParisParts,shiftDayAdd} from './shift-calendar.mjs';
const availabilityKey=value=>String(value??'').trim().toLocaleLowerCase('fr');
// Comparaison en heure civile de Paris : aucun cycle 5×8 n’est extrapolé.
export function nextOwnerPresence(rows,team,now=new Date(),{start=8*60,end=17*60}={}){
 if(![...SHIFT_TEAMS,'Jour'].includes(team))return null;
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>1440||start>=end)throw Error('Horaires de journée invalides.');
 const p=shiftParisParts(now),minute=p.hour*60+p.minute+p.second/60;
 const candidates=team==='Jour'?Array.from({length:8},(_,n)=>({date:shiftDayAdd(p.date,n),code:'Jour'})):rows.filter(r=>r.team===team&&r.date>=p.date&&['M','S'].includes(r.code)).sort((a,b)=>a.date.localeCompare(b.date));
 for(const row of candidates){const weekday=new Date(row.date+'T12:00:00Z').getUTCDay();if(weekday===0||weekday===6)continue;const from=Math.max(start,row.code==='M'?300:row.code==='S'?780:start),to=Math.min(end,row.code==='M'?780:row.code==='S'?1260:end);if(from>=to||row.date===p.date&&minute>=to)continue;return {date:row.date,from,to,code:row.code,now:row.date===p.date&&minute>=from};}
 return null;
}
export function equipmentOwnerPresences(equipment,contacts,rows,now=new Date(),hours){
 return equipmentOwners(equipment).flatMap(owner=>{const contact=contacts.find(c=>availabilityKey(c.owner)===availabilityKey(owner)),team=contact?.team??equipment.team;if(![...SHIFT_TEAMS,'Jour'].includes(team))return [];return [{owner,team,presence:nextOwnerPresence(rows,team,now,hours)}];});
}
