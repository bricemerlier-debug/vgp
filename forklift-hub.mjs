const panel = document.createElement('dialog');
panel.className = 'forklift-space';
panel.setAttribute('aria-label', 'Choc chariot');
document.body.append(panel);
const sections = [['chariots', 'Chariots', 'Les fiches des chariots de l’usine'], ['conducteurs', 'Conducteurs', 'Les fiches des conducteurs'], ['kpi', 'KPI', 'Le suivi des chocs et des tendances']];
function render(section) {
 const entry = sections.find(item => item[0] === section);
 panel.innerHTML = `<div class="dialoghead"><h2>Choc chariot</h2><button class="close" aria-label="Fermer">×</button></div><p class="eyebrow">ENGINEERING PLANT FLOOR</p>${entry ? `<button class="secondary" data-back>← Retour à l’espace Choc chariot</button><h3>${entry[1]}</h3><p>${entry[2]}</p><p>Aucune donnée enregistrée dans cet espace pour le moment. Les fiches et indicateurs seront préparés à la prochaine étape.</p>` : `<h3>Choisissez votre rubrique</h3><div class="forklift-grid">${sections.map(([id, title, description]) => `<button class="forklift-card" data-section="${id}"><img class="forklift-icon" src="assets/forklift/${id}.svg" alt=""><strong>${title}</strong><span>${description}</span><span aria-hidden="true">→</span></button>`).join('')}</div>`}<p class="foot">Connexion automatique aux capteurs / Aprolis : non configurée.</p>`;
 panel.querySelector('.close').onclick = () => panel.close();
 panel.querySelector('[data-back]')?.addEventListener('click', () => render());
 panel.querySelectorAll('[data-section]').forEach(button => button.onclick = () => render(button.dataset.section));
}
document.querySelectorAll('[data-hub-space="Choc chariot"]').forEach(button => {
 button.classList.remove('hub-card-pending'); button.classList.add('hub-card-active');
 const label = button.querySelector('b + span'); if (label) label.textContent = 'Chariots, conducteurs et KPI →';
 button.addEventListener('click', event => {event.stopImmediatePropagation(); render(); panel.showModal();}, true);
});
