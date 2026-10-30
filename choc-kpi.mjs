// Les données et les règles de rapprochement des chocs restent à définir avec Aprolis.
export function chocKpiContent() {
 return `<div class="workspace-panel-heading"><h2>KPI Choc chariot</h2></div>
 <p class="choc-kpi-intro">Les indicateurs prennent en compte les chocs de niveaux 3, 4 et 5. Les niveaux 1 et 2 sont exclus.</p>
 <div class="choc-kpi-levels" aria-label="Niveaux de choc suivis"><span>Niveau 3</span><span>Niveau 4</span><span>Niveau 5</span></div>
 <div class="choc-kpi-grid"><section class="choc-kpi-block" aria-labelledby="choc-sector-title"><h3 id="choc-sector-title">Chocs par secteur</h3><p>Nombre de chocs par secteur, niveaux 3 à 5.</p><div class="choc-kpi-empty">Aucune donnée disponible pour afficher les secteurs.</div></section>
 <section class="choc-kpi-block" aria-labelledby="choc-driver-title"><h3 id="choc-driver-title">Classement des conducteurs</h3><p>Classement par nombre de chocs de niveaux 3 à 5, du plus élevé au plus faible.</p><div class="choc-kpi-empty">Aucune donnée disponible pour établir le classement.</div></section></div>
 <p class="foot">Données des capteurs / Aprolis : connexion non configurée.</p>`;
}
