import { chocKpiContent } from './choc-kpi.mjs?v=1';
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
 panel.innerHTML = `<div class="dialoghead"><h2 id="miniHubTitle">${space.title}</h2><button type="button" class="close" aria-label="Fermer">×</button></div><p class="eyebrow">ENGINEERING PLANT FLOOR</p><h3>Choisissez votre rubrique</h3><div class="forklift-grid">${space.items.map(([id,title,description]) => `<button type="button" class="forklift-card" data-section="${id}">${name === 'containers' ? document.querySelector(({list:'#containerListTab',agenda:'#containerAgendaTab',kpi:'#containerKpiTab'})[id] + ' .container-tab-icon').outerHTML : `<img class="forklift-icon" src="assets/${name === 'choc' ? 'forklift' : 'vgp-hub'}/${id}.svg" alt="">`}<strong>${title}</strong><span>${description}</span><span aria-hidden="true">→</span></button>`).join('')}</div>${name === 'choc' ? '<p class="foot">Connexion automatique aux capteurs / Aprolis : non configurée.</p>' : ''}`;
 panel.querySelector('.close').onclick = () => panel.close();
 panel.querySelectorAll('[data-section]').forEach(button => button.onclick = () => {
  const id = button.dataset.section;
  if (name === 'choc') { panel.close(); openChocPage(id); return; }
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

const chocHome = document.querySelector('#homeView');
const chocPage = document.createElement('section');
chocPage.className = 'choc-workspace';
chocPage.hidden = true;
chocHome.append(chocPage);
function openChocPage(id) {
 const names = {chariots:'Fiche chariot',conducteurs:'Fiche conducteur',kpi:'KPI Choc chariot'};
 if (!names[id]) return;
 document.querySelector('#homeLogo').click();
 chocHome.classList.add('hub-show-dashboard');
 document.documentElement.classList.add('choc-mode');
 chocPage.hidden = false;
 document.querySelector('#headerSiteTitle').textContent = 'Suivi des chocs chariot Goodyear Amiens';
 chocPage.innerHTML = `<div class="workspace-hero choc-workspace-hero"><div><span class="workspace-hero-kicker">GOODYEAR AMIENS · CHOC CHARIOT</span><h1>Suivi des chocs chariot</h1></div><div class="workspace-hero-brand"><img src="assets/goodyear-logo.jpg" alt="Goodyear"><span>GOODYEAR AMIENS</span></div></div><div class="tabs choc-tabs" role="group" aria-label="Rubriques Choc chariot">${spaces.choc.items.map(([key,title])=>`<button type="button" class="${key === id ? '' : 'secondary'}" data-choc-tab="${key}" aria-pressed="${key === id}">${title}</button>`).join('')}</div><section class="panel choc-sheet">${id === 'kpi' ? chocKpiContent() : `<div class="workspace-panel-heading choc-section-heading"><h2>${id === 'chariots' ? 'Chariots' : 'Conducteurs'}</h2><button type="button" disabled>+ Ajouter ${id === 'chariots' ? 'un chariot' : 'un conducteur'}</button></div><label class="choc-search">Rechercher ${id === 'chariots' ? 'un chariot' : 'un conducteur'}<input type="search" placeholder="${id === 'chariots' ? 'Numéro du chariot…' : 'Nom du conducteur…'}" disabled></label><div class="choc-card-grid" aria-live="polite"></div><p class="choc-empty-text">Les fiches seront disponibles lorsque leurs informations et leur mode d’enregistrement seront définis.</p>`}</section>`;
 chocPage.querySelectorAll('[data-choc-tab]').forEach(button => button.onclick = () => openChocPage(button.dataset.chocTab));
}
function leaveChoc() { document.documentElement.classList.remove('choc-mode'); chocPage.hidden = true; }
document.querySelectorAll('#homeLogo, [data-view], #switchToContainers, #switchToVgp').forEach(button => button.addEventListener('click', leaveChoc, true));
