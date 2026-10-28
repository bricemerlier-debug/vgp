const dialog = document.querySelector('#hubSpaceDialog');
const title = document.querySelector('#hubSpaceTitle');
document.querySelectorAll('[data-hub-space]').forEach(button => {
  button.addEventListener('click', () => {
    title.textContent = button.dataset.hubSpace;
    dialog.showModal();
  });
});
document.querySelector('#hubSpaceClose').addEventListener('click', () => dialog.close());
document.querySelector('[data-hub-open="containers"]').addEventListener('click', () => document.querySelector('#switchToContainers').click());
const home = document.querySelector('#homeView');
document.querySelectorAll('#homeLogo, [data-view="home"]').forEach(button => button.addEventListener('click', () => home.classList.remove('hub-show-dashboard')));
const dashboard = document.createElement('button');
dashboard.type = 'button';
dashboard.textContent = 'Tableau de bord VGP';
dashboard.addEventListener('click', () => {
  document.querySelector('#homeLogo').click();
  if (!home.hidden) {
    home.classList.add('hub-show-dashboard');
    const workspace = document.querySelector('#vgpWorkspace');
    workspace.hidden = false;
    workspace.querySelectorAll('[role=tab]').forEach(tab => { tab.setAttribute('aria-selected', 'false'); tab.tabIndex = -1; });
    dashboardTab.setAttribute('aria-selected', 'true');
    dashboardTab.tabIndex = 0;
  }
  document.querySelector('#navigation').close();
});
document.querySelector('[aria-label="VGP"]').append(dashboard);
const dashboardTab = document.createElement('button');
dashboardTab.type = 'button';
dashboardTab.id = 'vgpDashboardTab';
dashboardTab.setAttribute('role', 'tab');
dashboardTab.setAttribute('aria-controls', 'homeView');
dashboardTab.setAttribute('aria-selected', 'false');
dashboardTab.tabIndex = -1;
dashboardTab.textContent = 'Tableau de bord';
dashboardTab.addEventListener('click', () => dashboard.click());
document.querySelector('#vgpWorkspace .workspace-tabs').prepend(dashboardTab);
document.querySelector('#vgpWorkspace').addEventListener('click', event => {
  if (event.target.closest('[data-workspace-view], #plansTrackingTab, #plansKpiTab')) {
    dashboardTab.setAttribute('aria-selected', 'false');
    dashboardTab.tabIndex = -1;
  }
});
document.querySelector('[data-hub-open="vgp"]').addEventListener('click', () => dashboard.click());
