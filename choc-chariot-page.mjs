const sections = [['chariots','Chariots','Les fiches des chariots de l’usine'],['conducteurs','Conducteurs','Les fiches des conducteurs'],['kpi','KPI','Le suivi des chocs et des tendances']];
const section = new URLSearchParams(location.search).get('rubrique');
const selected = sections.find(item => item[0] === section);
const content = document.querySelector('#content');
if (selected) {
 content.innerHTML = `<a href="choc-chariot.html">← Retour à Choc chariot</a><h2>${selected[1]}</h2><p>${selected[2]}</p><p>Cette rubrique est en préparation.</p>`;
} else {
 content.innerHTML = `<h2>Choisissez votre rubrique</h2><div class="forklift-grid">${sections.map(([id,title,description]) => `<a class="forklift-card" href="choc-chariot.html?rubrique=${id}"><img class="forklift-icon" src="assets/forklift/${id}.svg" alt=""><strong>${title}</strong><span>${description}</span><span aria-hidden="true">→</span></a>`).join('')}</div>`;
}
