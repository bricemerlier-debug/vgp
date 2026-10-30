export const CHOC_WEIGHTS = Object.freeze({3: 1, 4: 2, 5: 3});
const byScore = (a,b) => b.score-a.score || b.count-a.count || a.label.localeCompare(b.label,'fr');
export function calculateChocKpis({events, drivers, vehicles, sectors, teams, sector = '', year = ''}) {
 const driverMap = new Map(drivers.map(driver => [driver.id,driver]));
 const vehicleMap = new Map(vehicles.map(vehicle => [vehicle.id,vehicle]));
 const accepted = events.filter(event => CHOC_WEIGHTS[event.level] && (!sector || event.sector === sector) && (!year || event.date.slice(0,4) === year));
 const group = (keys, keyFor, labelFor) => keys.map(key => {
  const matching = accepted.filter(event => keyFor(event) === key);
  const levels = [3,4,5].map(level => matching.filter(event => event.level === level).length);
  return {key, label:labelFor(key), count:matching.length, levels, score:matching.reduce((sum,event)=>sum+CHOC_WEIGHTS[event.level],0)};
 });
 const observed = [...new Set(accepted.map(event => event.date.slice(0,7)))].sort();
 const months = [];
 if (observed.length) {
  const cursor = new Date(`${observed[0]}-01T00:00:00Z`);
  while (cursor.toISOString().slice(0,7) <= observed.at(-1)) { months.push(cursor.toISOString().slice(0,7)); cursor.setUTCMonth(cursor.getUTCMonth()+1); }
 }
 return {
  accepted,
  levelCounts:[3,4,5].map(level=>accepted.filter(event=>event.level===level).length),
  totalScore:accepted.reduce((sum,event)=>sum+CHOC_WEIGHTS[event.level],0),
  months:group(months,event=>event.date.slice(0,7),key=>key),
  sectors:group(sectors,event=>event.sector,key=>key).filter(row=>!sector || row.key===sector).sort(byScore),
  teams:group(teams,event=>driverMap.get(event.driverId)?.team,key=>key),
  drivers:group(drivers.map(driver=>driver.id),event=>event.driverId,key=>driverMap.get(key)?.name || key).filter(row=>row.count).sort(byScore).map(row=>({...row,team:driverMap.get(row.key)?.team || 'Non renseignée'})),
  vehicles:group(vehicles.map(vehicle=>vehicle.id),event=>event.vehicleId,key=>vehicleMap.get(key)?.name || key).filter(row=>row.count).sort(byScore).map(row=>({...row,sector:vehicleMap.get(row.key)?.sector || 'Non renseigné'})),
  severe:accepted.filter(event=>event.level===5).slice().sort((a,b)=>b.date.localeCompare(a.date)).map(event=>({...event,driverName:driverMap.get(event.driverId)?.name || event.driverId,vehicleName:vehicleMap.get(event.vehicleId)?.name || event.vehicleId}))
 };
}
