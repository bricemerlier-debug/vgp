const dialog = document.querySelector('#hubSpaceDialog');
const title = document.querySelector('#hubSpaceTitle');
document.querySelectorAll('[data-hub-space]').forEach(button => {
  button.addEventListener('click', () => {
    title.textContent = button.dataset.hubSpace;
    dialog.showModal();
  });
});
document.querySelector('#hubSpaceClose').addEventListener('click', () => dialog.close());
document.querySelector('[data-hub-open="vgp"]').addEventListener('click', () => document.querySelector('#switchToVgp').click());
document.querySelector('[data-hub-open="containers"]').addEventListener('click', () => document.querySelector('#switchToContainers').click());
const home = document.querySelector('#homeView');
const dashboard = document.querySelector('#hubDashboard');
dashboard.addEventListener('click', () => {
  const shown = home.classList.toggle('hub-show-dashboard');
  dashboard.textContent = shown ? 'Masquer le tableau de bord VGP' : 'Afficher le tableau de bord VGP';
});
