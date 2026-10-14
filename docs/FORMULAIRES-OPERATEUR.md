# Création et affectation du matériel

- Choisir un type verrouille la saisie du nom ; le type et la variante construisent le nom affiché. Choisir « Nom libre / non standardisé » permet de saisir le nom. Les noms d’origine des fiches déjà importées restent conservés.
- Un nouveau type possède une périodicité de suivi de 3, 6, 9 ou 12 mois, commune à ses variantes. La sélection du type reprend cette périodicité pour une nouvelle fiche. Les anciens types sans périodicité demandent de la définir avant la création. Le bouton « Périodicité du type » permet de gérer ce réglage. Cela ne valide pas automatiquement une règle réglementaire et ne modifie pas les fiches existantes ni leurs échéances.
- La page Propriétaires propose un accès direct par liste, une recherche par nom ou e-mail et un tri alphabétique ou par nombre d’équipements actifs. L’association permet aussi de créer une nouvelle fiche avec le propriétaire présélectionné.
- Chaque liste déroulante possède un champ de recherche ; le choix sélectionné reste visible pendant la recherche. Les champs restent des listes natives utilisables au clavier et sur mobile.
- Les dates manuelles conservent leur justification et validation ; leur origine technique « Saisie manuelle » est enregistrée sans demander un champ supplémentaire.
- Les nouveaux rapports suivent la séquence 1, 2, 3 dans l’espace de données, après le plus grand numéro numérique enregistré. Les anciennes références et les rapports existants restent inchangés. Le contrôle de révision Supabase rejette une écriture concurrente obsolète : actualiser les données avant de réessayer. Une création annulée ne réserve pas un numéro.

Validation : tests navigateur sur données fictives (création, périodicité, variante, recherche, affectation, rapports successifs et persistance), régression propriétaires/nomenclature/rapports et génération PDF. Aucune donnée de production utilisée ou modifiée par les tests.
