# Création et affectation du matériel

- Le type est vide par défaut et le nom est grisé. Choisir un type verrouille la saisie du nom ; le type et la variante construisent le nom affiché. Choisir « Nom libre / non standardisé » permet de saisir le nom. Les noms d’origine des fiches déjà importées restent conservés.
- Un nouveau type possède une périodicité de suivi de 3, 6, 9 ou 12 mois, commune à ses variantes. La sélection du type reprend cette périodicité pour une nouvelle fiche. Les anciens types sans périodicité demandent de la définir avant la création. Le bouton « Périodicité du type » permet de gérer ce réglage. Cela ne valide pas automatiquement une règle réglementaire et ne modifie pas les fiches existantes ni leurs échéances.
- La page Propriétaires propose un accès direct par liste, une recherche par nom ou e-mail et un tri alphabétique ou par nombre d’équipements actifs. L’association permet aussi de créer une nouvelle fiche avec le propriétaire présélectionné.
- Chaque liste déroulante ouvre une recherche intégrée au menu. Aucun champ de recherche supplémentaire n’est affiché au-dessus. Les menus sont utilisables au clavier (flèches, Entrée, Échap) et sur mobile ; les valeurs des formulaires restent conservées dans les champs natifs.
- Les dates manuelles ne demandent aucune justification. Leur auteur et leur confirmation restent conservés ; la mention technique « Échéance saisie manuellement » est enregistrée automatiquement. L’historique est replié dans la fiche.
- Les nouveaux rapports suivent la séquence 1, 2, 3 dans l’espace de données, après le plus grand numéro numérique enregistré. Les anciennes références et les rapports existants restent inchangés. Le contrôle de révision Supabase rejette une écriture concurrente obsolète : actualiser les données avant de réessayer. Une création annulée ne réserve pas un numéro.

Validation : tests navigateur sur données fictives (création, périodicité, variante, recherche, affectation, rapports successifs et persistance), régression propriétaires/nomenclature/rapports et génération PDF. Aucune donnée de production utilisée ou modifiée par les tests.

## Fiche propriétaire

La fiche conserve l’adresse e-mail et propose équipe (A, B, C, D, E, Jour), service (IT, HSE, Métrologie, RH), secteur (A1, A2, B1, B2, B3), et sous-secteur / zone (DMCR, Yuzer sous B2). Les champs sont facultatifs. Changer de secteur efface le sous-secteur incompatible lors de l’enregistrement. La recherche des propriétaires accepte aussi leur affectation. Ces informations sont enregistrées dans le profil existant `ownerContacts`, dans le même stockage local ou Supabase que les coordonnées ; aucune migration SQL supplémentaire nécessaire. Les affectations des équipements restent indépendantes de la fiche propriétaire. Les anciens profils sans ces champs restent compatibles.

Le nom du propriétaire est modifiable directement dans sa fiche. Le renommage met à jour ses associations actuelles, conserve ses coordonnées et enregistre l’ancien nom dans un historique. Un nom déjà utilisé par un autre propriétaire est refusé. Les contrôles et leurs documents/snapshots historiques restent inchangés.
