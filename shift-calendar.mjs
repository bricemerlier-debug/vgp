// Calendar days belong to the shift START date, in Europe/Paris. No rotation is extrapolated.
export const SHIFT_TEAMS=Object.freeze(['A','B','C','D','E']);
export const SHIFT_CODES=Object.freeze({M:'Matin',S:'Soir',N:'Nuit',R:'Repos',CP:'Congés',JF:'Jour férié',RTT:'RTT',F:'Formation'});
export const SHIFT_MIN_DATE='2026-10-01';
const shiftFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function shiftDateValid(date){return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&!isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;}
export function shiftDayAdd(date,days){if(!shiftDateValid(date))throw Error('Date de planning invalide.');return new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);}
export function shiftParisParts(now=new Date()){const p=Object.fromEntries(shiftFormatter.formatToParts(now).map(p=>[p.type,p.value]));return {date:`${p.year}-${p.month}-${p.day}`,hour:Number(p.hour),minute:Number(p.minute),second:Number(p.second)};}
export function shiftInstant(date,hour){
 if(!shiftDateValid(date)||![5,13,21].includes(hour))throw Error('Horaire du poste invalide.');
 const target=Date.parse(`${date}T${String(hour).padStart(2,'0')}:00:00Z`);let utc=target;
 for(let n=0;n<3;n++){const p=shiftParisParts(new Date(utc));const local=Date.parse(p.date+'T'+String(p.hour).padStart(2,'0')+':'+String(p.minute).padStart(2,'0')+':'+String(p.second).padStart(2,'0')+'Z');utc+=target-local;}
 return new Date(utc).toISOString();
}
export function shiftSlot(date,code){
 const startHour={M:5,S:13,N:21}[code];if(startHour===undefined) return {date,code,start:null,end:null};
 const endHour={M:13,S:21,N:5}[code],endDate=code==='N'?shiftDayAdd(date,1):date;
 return {date,code,start:shiftInstant(date,startHour),end:shiftInstant(endDate,endHour)};
}
export function shiftCurrentSlot(now=new Date()){const p=shiftParisParts(now);return shiftSlot(p.hour<5?shiftDayAdd(p.date,-1):p.date,p.hour<5||p.hour>=21?'N':p.hour<13?'M':'S');}
export function shiftNextSlot(slot){return shiftSlot(slot.code==='N'?shiftDayAdd(slot.date,1):slot.date,{M:'S',S:'N',N:'M'}[slot.code]);}
export function shiftOccupant(rows,slot){const found=rows.filter(r=>r.date===slot.date&&r.code===slot.code);return found.length===1?found[0]:null;}
export function shiftSlotState(rows,slot){if(shiftOccupant(rows,slot))return 'present';const day=rows.filter(r=>r.date===slot.date);return day.length===5&&SHIFT_TEAMS.every(t=>day.some(r=>r.team===t&&r.code!==null))?'off':'unknown';}
export function shiftCurrent(rows,now=new Date()){const slot=shiftCurrentSlot(now),next=shiftNextSlot(slot);return {...slot,assignment:shiftOccupant(rows,slot),state:shiftSlotState(rows,slot),next:{...next,assignment:shiftOccupant(rows,next),state:shiftSlotState(rows,next)}};}
export function shiftRowsValid(rows){return Array.isArray(rows)&&rows.length<=20000&&rows.every(r=>r&&shiftDateValid(r.date)&&r.date>=SHIFT_MIN_DATE&&r.date<='2100-12-31'&&SHIFT_TEAMS.includes(r.team)&&(r.code===null||Object.hasOwn(SHIFT_CODES,r.code))&&typeof r.sourceCell==='string'&&r.sourceCell.length<=50)&&new Set(rows.map(r=>r.date+'|'+r.team)).size===rows.length&&['M','S','N'].every(code=>new Set(rows.filter(r=>r.code===code).map(r=>r.date)).size===rows.filter(r=>r.code===code).length);}
const shiftCellDate=value=>{if(value instanceof Date&&!isNaN(value))return value.toISOString().slice(0,10);if(typeof value==='string'&&shiftDateValid(value.slice(0,10)))return value.slice(0,10);return null;};
const shiftExcelCell=(r,c)=>{let col='';for(let n=c+1;n;n=Math.floor((n-1)/26))col=String.fromCharCode(65+(n-1)%26)+col;return col+(r+1);};
export function parseShiftGlobal(grid,{from=SHIFT_MIN_DATE,to='2100-12-31'}={}){
 if(!shiftDateValid(from)||!shiftDateValid(to)||from<SHIFT_MIN_DATE||from>to)throw Error('Choisissez une période à partir du 01/10/2026.');
 const rows=[],warnings=[],seen=new Map();let headers=0,ignored=0;
 for(let r=0;r<grid.length;r++)for(let c=1;c<(grid[r]?.length||0);c++){
  if(['M','S','N',...SHIFT_TEAMS].some((h,i)=>String(grid[r][c+i]??'').trim()!==h))continue;headers++;
  for(let rr=r+1;rr<Math.min(r+32,grid.length);rr++){
   const date=shiftCellDate(grid[rr]?.[c-1]);if(!date)continue;if(date<from||date>to){ignored++;continue;}
   const raw=grid[rr]||[],assignments=new Map();
   for(let i=0;i<3;i++){const value=String(raw[c+i]??'').trim().toUpperCase();if(!value||['JF','CP','RTT'].includes(value))continue;if(!SHIFT_TEAMS.includes(value))throw Error(`Code de poste non reconnu en ${shiftExcelCell(rr,c+i)} : ${value}`);if(assignments.has(value))throw Error(`Équipe ${value} affectée à plusieurs postes le ${date}.`);assignments.set(value,{code:['M','S','N'][i],sourceCell:shiftExcelCell(rr,c+i)});}
   for(let i=0;i<5;i++){
    const team=SHIFT_TEAMS[i],sourceCell=shiftExcelCell(rr,c+3+i),marker=String(raw[c+3+i]??'').trim().toUpperCase(),assigned=assignments.get(team);let code=null,cell=sourceCell;
    if(['CP','JF','RTT','F'].includes(marker)){code=marker;if(assigned)warnings.push({date,team,message:`${marker} prioritaire sur la rotation ${assigned.code}`,sourceCell});}
    else if(marker===team||marker==='R'){if(assigned)throw Error(`Équipe ${team} indiquée en poste et au repos le ${date}.`);code='R';}
    else if(marker)throw Error(`Code d’équipe non reconnu en ${sourceCell} : ${marker}`);
    else if(assigned){code=assigned.code;cell=assigned.sourceCell;}
    const entry={date,team,code,sourceCell:cell},key=date+'|'+team;
    if(seen.has(key)){if(seen.get(key).code!==code)throw Error(`Affectations contradictoires le ${date}, équipe ${team}.`);continue;}seen.set(key,entry);rows.push(entry);
   }
  }
 }
 rows.sort((a,b)=>a.date.localeCompare(b.date)||a.team.localeCompare(b.team));
 if(!headers||!rows.length)throw Error('Aucun planning compatible dans « calendrier global » pour cette période.');
 if(!shiftRowsValid(rows))throw Error('Planning incohérent : dates, codes ou affectations en double.');
 return {rows,warnings,ignored,from:rows[0].date,to:rows.at(-1).date,days:new Set(rows.map(r=>r.date)).size,unknown:rows.filter(r=>r.code===null).length};
}
export function shiftImportPreview(existing,incoming){if(!shiftRowsValid(incoming))throw Error('Planning importé invalide.');const map=new Map(existing.map(r=>[r.date+'|'+r.team,r]));return incoming.map(row=>{const previous=map.get(row.date+'|'+row.team);return {row,previous:previous||null,kind:!previous?'new':previous.code===row.code?'same':'conflict'};});}
export function shiftUpcoming(rows,team,from,limit=10){return rows.filter(r=>r.team===team&&r.date>=from&&['M','S','N'].includes(r.code)).sort((a,b)=>a.date.localeCompare(b.date)||a.code.localeCompare(b.code)).slice(0,limit).map(r=>({...r,...shiftSlot(r.date,r.code)}));}
