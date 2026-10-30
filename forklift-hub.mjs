const panel = document.createElement('dialog');
panel.className = 'forklift-space';
panel.setAttribute('aria-labelledby', 'miniHubTitle');
document.body.append(panel);
const spaces = {
 choc: {title:'Choc chariot', items:[['chariots','Chariots','Les fiches des chariots de l’usine'],['conducteurs','Conducteurs','Les fiches des conducteurs'],['kpi','KPI','Le suivi des chocs et des tendances']]},
 containers: {title:'Contenants', items:[['list','Parc des contenants','Consulter les contenants'],['agenda','Agenda','Préventifs à venir'],['kpi','KPI','Indicateurs des contenants']]},
 vgp: {title:'VGP', items:[['material','Liste du matériel','Équipements et contrôles'],['kpi','KPI','Indicateurs VGP'],['planning','Agenda','Contrôles à venir'],['actions','Suivi des plans d’action','Actions et avancement']]}
};
function openHub(name) {
 const space = spaces[name];
 panel.classList.toggle('vgp-mini-hub', name === 'vgp');
 panel.classList.toggle('container-mini-hub', name === 'containers');
 panel.innerHTML = `<div class="dialoghead"><h2 id="miniHubTitle">${space.title}</h2><button type="button" class="close" aria-label="Fermer">×</button></div><p class="eyebrow">ENGINEERING PLANT FLOOR</p><h3>Choisissez votre rubrique</h3><div class="forklift-grid">${space.items.map(([id,title,description]) => `<button type="button" class="forklift-card" data-section="${id}">${name === 'containers' ? document.querySelector(({list:'#containerListTab',agenda:'#containerAgendaTab',kpi:'#containerKpiTab'})[id] + ' svg').outerHTML : `<img class="forklift-icon" src="assets/${name === 'choc' ? 'forklift' : 'vgp-hub'}/${id}.svg" alt="">`}<strong>${title}</strong><span>${description}</span><span aria-hidden="true">→</span></button>`).join('')}</div>${name === 'choc' ? '<p class="foot">Connexion automatique aux capteurs / Aprolis : non configurée.</p>' : ''}`;
 panel.querySelector('.close').onclick = () => panel.close();
 panel.querySelectorAll('[data-section]').forEach(button => button.onclick = () => {
  const id = button.dataset.section;
  if (name === 'choc') { location.href = `choc-chariot.html?rubrique=${id}`; return; }
  panel.close();
  if (name === 'containers') {
   document.querySelector('#switchToContainers').click();
   document.querySelector(({list:'#containerListTab',agenda:'#containerAgendaTab',kpi:'#containerKpiTab'})[id]).click();
   return;
  }
  const target = id === 'actions' ? '#plansTrackingTab' : `[data-workspace-view="${id}"]`;
  document.querySelector(target).click();
 });
 panel.showModal();
}
document.querySelectorAll('[data-hub-space="Choc chariot"]').forEach(button => {
 button.classList.remove('hub-card-pending'); button.classList.add('hub-card-active');
 const label = button.querySelector('b + span'); if (label) label.textContent = 'Chariots, conducteurs et KPI →';
 button.addEventListener('click', event => {event.stopImmediatePropagation(); openHub('choc');}, true);
});
document.querySelector('[data-hub-open="vgp"]')?.addEventListener('click', event => {event.stopImmediatePropagation(); openHub('vgp');}, true);

document.querySelector('[data-hub-open="containers"]')?.addEventListener('click', event => {event.stopImmediatePropagation(); openHub('containers');}, true);
