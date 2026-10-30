import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateChocKpis} from '../choc-kpi-calculations.mjs';
const drivers=[{id:'d1',name:'Alice',team:'A'},{id:'d2',name:'Bob',team:'B'}];
const vehicles=[{id:'v1',name:'Chariot 1',sector:'A1'},{id:'v2',name:'Chariot 2',sector:'B2'}];
const events=[
 {driverId:'d1',vehicleId:'v1',sector:'A1',level:3,date:'2026-01-01T10:00:00Z'},
 {driverId:'d1',vehicleId:'v1',sector:'A1',level:5,date:'2026-01-02T10:00:00Z'},
 {driverId:'d2',vehicleId:'v2',sector:'B2',level:4,date:'2026-02-01T10:00:00Z'},
 {driverId:'d2',vehicleId:'v2',sector:'B2',level:2,date:'2026-02-02T10:00:00Z'},
 {driverId:'d2',vehicleId:'v2',sector:'B2',level:5,date:'2025-02-01T10:00:00Z'},
];
const run=(options={})=>calculateChocKpis({events,drivers,vehicles,sectors:['A1','B2'],teams:['A','B'],...options});
test('pondération, exclusion des petits chocs, regroupement et classements',()=>{
 const r=run({year:'2026'});assert.deepEqual(r.levelCounts,[1,1,1]);assert.equal(r.totalScore,6);assert.deepEqual(r.sectors.map(x=>[x.key,x.count,x.score]),[['A1',2,4],['B2',1,2]]);assert.deepEqual(r.teams.map(x=>[x.key,...x.levels]),[['A',1,0,1],['B',0,1,0]]);assert.deepEqual(r.months.map(x=>[x.key,x.count]),[['2026-01',2],['2026-02',1]]);assert.deepEqual(r.drivers.map(x=>[x.key,x.score]),[['d1',4],['d2',2]]);assert.deepEqual(r.vehicles.map(x=>[x.key,x.score]),[['v1',4],['v2',2]]);assert.equal(r.severe.length,1);assert.equal(r.severe[0].driverName,'Alice');
});
test('filtres secteur et année et résultat vide',()=>{
 const r=run({sector:'B2',year:'2026'});assert.equal(r.accepted.length,1);assert.equal(r.totalScore,2);assert.deepEqual(r.sectors.map(x=>x.key),['B2']);assert.equal(r.drivers[0].key,'d2');
 const empty=run({sector:'A1',year:'2024'});assert.equal(empty.totalScore,0);assert.deepEqual(empty.levelCounts,[0,0,0]);assert.equal(empty.drivers.length,0);assert.equal(empty.severe.length,0);
});
test('évolution : les mois intermédiaires sans choc sont affichés à zéro',()=>{
 const r=calculateChocKpis({events:[events[0],{...events[2],date:'2026-03-01T00:00:00Z'}],drivers,vehicles,sectors:['A1','B2'],teams:['A','B']});
 assert.deepEqual(r.months.map(x=>[x.key,x.count]),[['2026-01',1],['2026-02',0],['2026-03',1]]);
});
