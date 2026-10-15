import assert from 'node:assert/strict';import {test} from 'node:test';
import {shiftCurrent,shiftSlot,shiftParisParts,parseShiftGlobal,shiftImportPreview,shiftUpcoming,shiftRowsValid,shiftSlotState} from '../shift-calendar.mjs';
const row=(date,team,code)=>({date,team,code,sourceCell:'A1'});
const rows=[row('2026-10-14','A','N'),row('2026-10-15','B','M'),row('2026-10-15','C','S'),row('2026-10-15','D','N'),row('2026-10-16','E','M')];
test('relèves 05 h, 13 h, 21 h Paris et nuit de la veille',()=>{
 for(const [utc,team,code,date,next] of [['2026-10-15T02:59:59Z','A','N','2026-10-14','B'],['2026-10-15T03:00:00Z','B','M','2026-10-15','C'],['2026-10-15T10:59:59Z','B','M','2026-10-15','C'],['2026-10-15T11:00:00Z','C','S','2026-10-15','D'],['2026-10-15T19:00:00Z','D','N','2026-10-15','E'],['2026-10-15T22:01:00Z','D','N','2026-10-15','E']]){const c=shiftCurrent(rows,new Date(utc));assert.equal(c.assignment.team,team);assert.equal(c.code,code);assert.equal(c.date,date);assert.equal(c.next.assignment.team,next);}
});
test('mois/année et périodes absentes : aucune extrapolation',()=>{
 const r=[row('2026-10-31','A','N'),row('2026-12-31','E','N'),row('2027-01-01','B','M')];assert.equal(shiftCurrent(r,new Date('2026-10-31T23:30Z')).date,'2026-10-31');const c=shiftCurrent(r,new Date('2027-01-01T03:59:59Z'));assert.equal(c.assignment.team,'E');assert.equal(c.next.assignment.team,'B');assert.equal(shiftCurrent(r,new Date('2027-01-02T12:00Z')).assignment,null);
});
test('nuits aux changements d’heure : 7 h et 9 h, horaires locaux inchangés',()=>{
 for(const [date,hours] of [['2027-03-27',7],['2026-10-24',9]]){const s=shiftSlot(date,'N');assert.equal((Date.parse(s.end)-Date.parse(s.start))/3600000,hours);assert.equal(shiftParisParts(new Date(s.start)).hour,21);assert.equal(shiftParisParts(new Date(s.end)).hour,5);}
});
const fixture=()=>[['OCT','date','M','S','N','A','B','C','D','E','+','Poste sous-équipe'],['J','2026-10-01','D','A','B','','','C','','','E1','M'],['V','2026-10-02','C','D','A','','B','','','E','A1','N'],['S','2026-10-03',null,null,null,null,null,null,null,null],['D','2026-10-04','A','B','C','CP','CP','CP','D','E']];
test('source globale uniquement, sous-équipes ignorées, CP prioritaires et vides inconnus',()=>{
 const p=parseShiftGlobal(fixture());assert.equal(p.days,4);assert.equal(p.rows.length,20);const get=(date,team)=>p.rows.find(r=>r.date===date&&r.team===team)?.code;assert.equal(get('2026-10-01','D'),'M');assert.equal(get('2026-10-01','C'),'R');assert.equal(get('2026-10-01','E'),null);assert.equal(get('2026-10-03','A'),null);assert.equal(get('2026-10-04','A'),'CP');assert.equal(p.warnings.length,3);assert.equal(p.rows.filter(r=>r.code==='M').length,2);assert.equal(shiftUpcoming(p.rows,'A','2026-10-01').length,2);assert.equal(shiftImportPreview(p.rows,p.rows).every(r=>r.kind==='same'),true);
 const changed=structuredClone(p.rows);changed[0].code='JF';assert.equal(shiftImportPreview(p.rows,changed).filter(i=>i.kind==='conflict').length,1);assert.equal(shiftRowsValid([...p.rows,p.rows[0]]),false);
});
test('début du 5×8, dates invalides et affectations contradictoires bloquées',()=>{
 assert.throws(()=>parseShiftGlobal(fixture(),{from:'2026-09-01'}),/01\/10/);const g=fixture();g[1][3]='D';assert.throws(()=>parseShiftGlobal(g),/plusieurs postes/);assert.equal(shiftRowsValid([row('2026-02-30','A','M')]),false);assert.equal(shiftRowsValid([row('2026-09-30','A','M')]),false);
});

test('absence connue distincte des données manquantes',()=>{const day=['A','B','C','D','E'].map(t=>row('2026-12-25',t,'JF'));assert.equal(shiftSlotState(day,shiftSlot('2026-12-25','M')),'off');day[0].code=null;assert.equal(shiftSlotState(day,shiftSlot('2026-12-25','M')),'unknown');});
