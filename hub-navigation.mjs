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
const workspace = document.querySelector('#vgpWorkspace');
home.before(workspace);
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
dashboardTab.className = 'vgp-dashboard-tab';
dashboardTab.id = 'vgpDashboardTab';
dashboardTab.setAttribute('role', 'tab');
dashboardTab.setAttribute('aria-controls', 'homeView');
dashboardTab.setAttribute('aria-selected', 'false');
dashboardTab.tabIndex = -1;
dashboardTab.innerHTML = '<svg class="vgp-tab-icon" viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="4" width="26" height="24" rx="3"/><path d="M7 22V17h4v5M14 22v-9h4v9M21 22V9h4v13M6 25h20"/></svg><span>Tableau de bord</span>';
dashboardTab.addEventListener('click', () => dashboard.click());
document.querySelector('#vgpWorkspace .workspace-tabs').prepend(dashboardTab);
document.querySelector('#vgpWorkspace').addEventListener('click', event => {
  if (event.target.closest('[data-workspace-view], #plansTrackingTab, #plansKpiTab')) {
    dashboardTab.setAttribute('aria-selected', 'false');
    dashboardTab.tabIndex = -1;
  }
});
document.querySelector('[data-hub-open="vgp"]').addEventListener('click', () => dashboard.click());
