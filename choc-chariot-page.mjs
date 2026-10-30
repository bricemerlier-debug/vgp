const sections = [['chariots','Chariots','Les fiches des chariots de l’usine'],['conducteurs','Conducteurs','Les fiches des conducteurs'],['kpi','KPI','Le suivi des chocs et des tendances']];
const section = new URLSearchParams(location.search).get('rubrique');
const selected = sections.find(item => item[0] === section);
const content = document.querySelector('#content');
const hero = (title) => `<header class="workspace-hero choc-hero"><div><span class="workspace-hero-kicker">GOODYEAR AMIENS · CHOC CHARIOT</span><h1>${title}</h1></div><div class="workspace-hero-brand"><img src="assets/goodyear-logo.jpg" alt="Goodyear"><span>GOODYEAR AMIENS</span></div></header>`;
if (section === 'chariots' || section === 'conducteurs') {
 const vehicle = section === 'chariots';
 const title = vehicle ? 'Fiche chariot' : 'Fiche conducteur';
 content.innerHTML = `${hero(title)}<section class="panel choc-sheet" aria-labelledby="sheet-title"><div class="toolbar"><div><p class="eyebrow">CHOC CHARIOT · ${title.toUpperCase()}</p><h2 id="sheet-title">${title}</h2></div><a class="secondary choc-return" href="choc-chariot.html">← Retour à Choc chariot</a></div><p class="choc-status" role="status">Le contenu de cette fiche sera défini ultérieurement.</p><div class="choc-empty"><h3>Informations de la fiche</h3><p>Les informations à afficher seront précisées prochainement.</p></div></section>`;
} else if (selected) {
 content.innerHTML = `${hero('KPI Choc chariot')}<section class="panel"><a href="choc-chariot.html">← Retour à Choc chariot</a><h2>KPI</h2><p>Cette rubrique est en préparation.</p></section>`;
} else {
 content.innerHTML = `${hero('Choc chariot')}<h2>Choisissez votre rubrique</h2><div class="forklift-grid">${sections.map(([id,title,description]) => `<a class="forklift-card" href="choc-chariot.html?rubrique=${id}"><img class="forklift-icon" src="assets/forklift/${id}.svg" alt=""><strong>${title}</strong><span>${description}</span><span aria-hidden="true">→</span></a>`).join('')}</div>`;
}
