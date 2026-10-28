const dialog = document.querySelector('#hubSpaceDialog');
const title = document.querySelector('#hubSpaceTitle');
document.querySelectorAll('[data-hub-space]').forEach(button => {
  button.addEventListener('click', () => {
    title.textContent = button.dataset.hubSpace;
    dialog.showModal();
  });
});
document.querySelector('#hubSpaceClose').addEventListener('click', () => dialog.close());
