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
  if (!home.hidden) home.classList.add('hub-show-dashboard');
  document.querySelector('#navigation').close();
});
document.querySelector('[aria-label="VGP"]').append(dashboard);
document.querySelector('[data-hub-open="vgp"]').addEventListener('click', () => dashboard.click());
