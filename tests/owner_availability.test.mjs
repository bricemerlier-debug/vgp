import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextOwnerPresence,equipmentOwnerPresences} from '../owner-availability.mjs';
const row=(date,code,team='A')=>({date,code,team});
test('créneaux communs matin/soir, heure actuelle et prochain jour après 17 h',()=>{
 const rows=[row('2026-10-15','M'),row('2026-10-16','S')];
 assert.deepEqual(nextOwnerPresence(rows,'A',new Date('2026-10-15T06:00Z')),{date:'2026-10-15',from:480,to:780,code:'M',now:true});
 assert.equal(nextOwnerPresence(rows,'A',new Date('2026-10-15T11:00Z')).date,'2026-10-16');
 assert.equal(nextOwnerPresence(rows,'A',new Date('2026-10-16T10:00Z')).from,780);
 assert.equal(nextOwnerPresence(rows,'A',new Date('2026-10-16T15:00Z')),null);
});
test('nuits, week-ends, repos, CP et trous de planning ne deviennent pas des présences',()=>{
 const rows=[row('2026-10-16','N'),row('2026-10-17','M'),row('2026-10-18','S'),row('2026-10-19','CP'),row('2026-10-20','R'),row('2026-10-21',null),row('2026-10-22','M')];
 assert.equal(nextOwnerPresence(rows,'A',new Date('2026-10-16T06:00Z')).date,'2026-10-22');
 assert.equal(nextOwnerPresence([],'A'),null);assert.equal(nextOwnerPresence(rows,'Pas d’équipe'),null);
});
test('Paris : changement d’heure, fin d’année et journée sans rotation extrapolée',()=>{
 assert.equal(nextOwnerPresence([row('2026-10-26','M')],'A',new Date('2026-10-26T07:00Z')).now,true);
 assert.equal(nextOwnerPresence([row('2027-01-01','S')],'A',new Date('2026-12-31T16:00Z')).date,'2027-01-01');
 assert.equal(nextOwnerPresence([],'Jour',new Date('2026-10-16T15:00Z')).date,'2026-10-19');
});
test('propriétaires multiples, équipe du propriétaire prioritaire, aucune déduction par le nom',()=>{
 const e={owner:'Alice',additionalOwners:['Bob','Sans équipe'],team:'A'},contacts=[{owner:'Alice',team:'B'},{owner:'Sans équipe',team:''}],rows=[row('2026-10-15','S','B'),row('2026-10-16','M')];
 const result=equipmentOwnerPresences(e,contacts,rows,new Date('2026-10-15T06:00Z'));assert.deepEqual(result.map(r=>[r.owner,r.team,r.presence.date]),[['Alice','B','2026-10-15'],['Bob','A','2026-10-16']]);
 assert.deepEqual(equipmentOwnerPresences({designation:'Harnais Alice équipe A',team:'A'},[],rows),[]);
 assert.deepEqual(equipmentOwnerPresences({owner:'Alice',team:''},[],rows),[]);
});
