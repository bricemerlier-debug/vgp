// Jeu fictif en mémoire : jamais envoyé au stockage de l'application.
const generate = (prefix, count) => Array.from({length:count}, (_, i) => {
 const number = String(i + 1).padStart(3, '0');
 return {id: `${prefix}-${number}`, name: prefix === 'SIM-CH' ? `Chariot fictif ${number}` : `Conducteur fictif ${number}`};
});
const firstNames = ['Lucas','Léa','Hugo','Camille','Nathan','Chloé','Mathis','Emma','Louis','Manon','Antoine','Sarah','Maxime','Clara','Thomas','Inès','Julien','Alice','Alexandre','Julie','Nicolas','Marie','Bastien','Élodie','Romain','Laura','Paul','Lucie','Adrien','Jade'];
export const sectors = ['A1','A2','B1','B2','B3'];
export const teams = ['A','B','C','D','E','Jour'];
export const simulatedChariots = generate('SIM-CH', 60).map((item,i) => ({...item, sector: sectors[i % sectors.length]}));
export const simulatedConducteurs = generate('SIM-CD', 150).map((item,i) => ({...item, name: `${firstNames[i % firstNames.length]} ${String(i + 1).padStart(3,'0')} · fictif`, team: teams[i % teams.length]}));
export const simulatedChocs = Array.from({length: 360}, (_, i) => {
 const chariot = simulatedChariots[(i * 17 + Math.floor(i / 19)) % simulatedChariots.length];
 const conducteur = simulatedConducteurs[(i * 37 + Math.floor(i / 13)) % simulatedConducteurs.length];
 const date = new Date(Date.UTC(2026, 0, 1 + (i * 7) % 300, 6 + i % 14, (i * 13) % 60));
 return {id: `SIM-CHOC-${String(i + 1).padStart(3,'0')}`, vehicleId: chariot.id, driverId: conducteur.id, sector: chariot.sector, level: 1 + ((i * 7 + Math.floor(i / 11)) % 5), date: date.toISOString()};
});

export function attachChocSimulation(root, type) {
 const items = type === 'chariots' ? simulatedChariots : simulatedConducteurs;
 const grid = root.querySelector('.choc-card-grid');
 const search = root.querySelector('.choc-search input');
 const count = root.querySelector('.choc-result-count');
 const results = root.querySelector('.choc-results');
 const detail = root.querySelector('.choc-profile');
 function render() {
  const query = search.value.trim().toLocaleLowerCase('fr');
  const filtered = items.filter(item => `${item.id} ${item.name} ${item.team || item.sector}`.toLocaleLowerCase('fr').includes(query));
  count.textContent = `${filtered.length} fiche(s) fictive(s) affichée(s) sur ${items.length}`;
  grid.replaceChildren();
  for (const item of filtered) {
   const card = document.createElement('article'); card.className = 'choc-person-card';
   const heading = document.createElement('h3'); heading.textContent = item.name;
   const reference = document.createElement('p'); reference.textContent = item.id;
   const group = document.createElement('p'); group.textContent = type === 'chariots' ? `Secteur : ${item.sector}` : `Équipe : ${item.team}`;
   const badge = document.createElement('p'); badge.className = 'choc-simulation-label'; badge.textContent = 'Fiche de simulation';
   const button = document.createElement('button'); button.className = 'secondary'; button.type = 'button'; button.textContent = 'Ouvrir la fiche';
   button.onclick = () => {results.hidden = true; detail.hidden = false; detail.querySelector('h3').textContent = item.name; detail.querySelector('[data-simulation-id]').textContent = item.id; detail.querySelector('[data-simulation-group]').textContent = type === 'chariots' ? `Secteur : ${item.sector}` : `Équipe : ${item.team}`; const history = detail.querySelector('[data-choc-history]'); const events = simulatedChocs.filter(event => type === 'chariots' ? event.vehicleId === item.id : event.driverId === item.id).sort((a,b) => b.date.localeCompare(a.date)); history.innerHTML = events.length ? events.map(event => `<li><strong>Niveau ${event.level}</strong> · ${new Date(event.date).toLocaleString('fr-FR', {timeZone:'UTC',dateStyle:'short',timeStyle:'short'})} · Secteur ${event.sector} · ${type === 'chariots' ? event.driverId : event.vehicleId}</li>`).join('') : '<li>Aucun choc fictif.</li>'; detail.querySelector('h3').focus();};
   card.append(heading,reference,group,badge,button); grid.append(card);
  }
 }
 search.addEventListener('input', render);
 detail.querySelector('[data-return-cards]').onclick = () => { detail.hidden = true; results.hidden = false; search.focus(); };
 render();
}
