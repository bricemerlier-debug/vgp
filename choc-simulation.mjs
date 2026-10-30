// Jeu fictif en mémoire : jamais envoyé au stockage de l'application.
const generate = (prefix, count) => Array.from({length:count}, (_, i) => {
 const number = String(i + 1).padStart(3, '0');
 return {id: `${prefix}-${number}`, name: prefix === 'SIM-CH' ? `Chariot fictif ${number}` : `Conducteur fictif ${number}`};
});
export const simulatedChariots = generate('SIM-CH', 60);
export const simulatedConducteurs = generate('SIM-CD', 150);

export function attachChocSimulation(root, type) {
 const items = type === 'chariots' ? simulatedChariots : simulatedConducteurs;
 const grid = root.querySelector('.choc-card-grid');
 const search = root.querySelector('.choc-search input');
 const count = root.querySelector('.choc-result-count');
 const results = root.querySelector('.choc-results');
 const detail = root.querySelector('.choc-profile');
 function render() {
  const query = search.value.trim().toLocaleLowerCase('fr');
  const filtered = items.filter(item => `${item.id} ${item.name}`.toLocaleLowerCase('fr').includes(query));
  count.textContent = `${filtered.length} fiche(s) fictive(s) affichée(s) sur ${items.length}`;
  grid.replaceChildren();
  for (const item of filtered) {
   const card = document.createElement('article'); card.className = 'choc-person-card';
   const heading = document.createElement('h3'); heading.textContent = item.name;
   const reference = document.createElement('p'); reference.textContent = item.id;
   const badge = document.createElement('p'); badge.className = 'choc-simulation-label'; badge.textContent = 'Fiche de simulation';
   const button = document.createElement('button'); button.className = 'secondary'; button.type = 'button'; button.textContent = 'Ouvrir la fiche';
   button.onclick = () => {results.hidden = true; detail.hidden = false; detail.querySelector('h3').textContent = item.name; detail.querySelector('[data-simulation-id]').textContent = item.id; detail.querySelector('h3').focus();};
   card.append(heading,reference,badge,button); grid.append(card);
  }
 }
 search.addEventListener('input', render);
 detail.querySelector('[data-return-cards]').onclick = () => { detail.hidden = true; results.hidden = false; search.focus(); };
 render();
}
