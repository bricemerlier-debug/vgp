import { sectors, simulatedChocs, simulatedConducteurs } from './choc-simulation.mjs?v=3';
const levels = [3,4,5];
const colors = ['#e6ad00','#eb6f2c','#bb352c'];
const weights = [1,2,3];
export function chocKpiContent() {
 return `<div class="workspace-panel-heading"><h2>KPI Choc chariot</h2></div><p class="choc-simulation-notice">Simulation : chocs, chariots et conducteurs fictifs. Aucune connexion Aprolis.</p><label class="choc-sector-picker">Secteur<select id="chocKpiSector"><option value="">Toute l’usine</option>${sectors.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></label><div id="chocKpiContent"></div><p class="foot">Données des capteurs / Aprolis : connexion non configurée.</p>`;
}
export function attachChocKpi(root) {
 const select = root.querySelector('#chocKpiSector');
 const content = root.querySelector('#chocKpiContent');
 function render() {
  const counted = simulatedChocs.filter(event => event.level >= 3 && event.level <= 5 && (!select.value || event.sector === select.value));
  const counts = levels.map(level => counted.filter(event => event.level === level).length);
  const points = counts.map((count,i) => count * weights[i]);
  const totalPoints = points.reduce((sum,value) => sum + value, 0);
  let cumulative = 0;
  const stops = points.map((point,i) => { const start = cumulative; cumulative += totalPoints ? point / totalPoints * 100 : 0; return `${colors[i]} ${start}% ${cumulative}%`; }).join(',');
  const ranking = simulatedConducteurs.map(driver => { const events = counted.filter(event => event.driverId === driver.id); return {...driver,count:events.length,score:events.reduce((sum,event)=>sum+weights[event.level-3],0)}; }).filter(driver => driver.count > 0).sort((a,b) => b.score-a.score || b.count-a.count || a.name.localeCompare(b.name,'fr'));
  content.innerHTML = `<div class="choc-kpi-grid"><section class="choc-kpi-block"><h3>Répartition pondérée des chocs</h3><p>${select.value ? `Secteur ${select.value}` : 'Toute l’usine'} · ${counted.length} chocs fictifs · ${totalPoints} points</p><div class="choc-pie-layout"><div class="choc-pie" role="img" aria-label="${levels.map((level,i)=>`Niveau ${level} : ${counts[i]} chocs, ${points[i]} points`).join(', ')}" style="background:${totalPoints ? `conic-gradient(${stops})` : '#dbe5ef'}"></div><ul class="choc-pie-legend">${levels.map((level,i)=>`<li><span class="choc-pie-dot" style="background:${colors[i]}"></span>Niveau ${level} <strong>${counts[i]} choc(s) · ${points[i]} pt(s)</strong></li>`).join('')}</ul></div><p class="foot">Pondération : niveau 3 = 1 point, niveau 4 = 2 points, niveau 5 = 3 points. Les niveaux 1 et 2 sont exclus.</p></section><section class="choc-kpi-block"><h3>Classement des conducteurs</h3><p>Score = somme des points des chocs fictifs. Classement du score le plus élevé au plus faible.</p><div class="choc-kpi-table-wrap"><table class="choc-kpi-table"><thead><tr><th>Rang</th><th>Conducteur fictif</th><th>Équipe</th><th>Chocs</th><th>Score</th></tr></thead><tbody>${ranking.map((item,i)=>`<tr><td>${i+1}</td><td>${item.name}</td><td>${item.team}</td><td>${item.count}</td><td><strong>${item.score} pts</strong></td></tr>`).join('')}</tbody></table>${ranking.length ? '' : '<p>Aucun choc dans ce secteur.</p>'}</div></section></div>`;
 }
 select.addEventListener('change', render); render();
}
