# Création et affectation du matériel

- Le type est vide par défaut et le nom est grisé. Choisir un type verrouille la saisie du nom ; le type et la variante construisent le nom affiché. Choisir « Nom libre / non standardisé » permet de saisir le nom. Le nom actuel est remplacé par le libellé standard choisi. Les noms d’origine des fiches déjà importées restent conservés dans `originalDesignation` et l’historique de classification, sans modifier les contrôles ou rapports existants.
- Un nouveau type possède une périodicité de suivi de 3, 6, 9 ou 12 mois, commune à ses variantes. La sélection du type reprend cette périodicité pour une nouvelle fiche. Les anciens types sans périodicité demandent de la définir avant la création. La périodicité utilise une liste native compacte. Un type ancien sans périodicité peut être configuré depuis cette liste lors de l’enregistrement de la fiche ; un type déjà configuré verrouille ce choix. Cela ne valide pas automatiquement une règle réglementaire et ne modifie pas les fiches existantes ni leurs échéances.
- La page Propriétaires propose un accès direct par liste, une recherche par nom ou e-mail et un tri alphabétique ou par nombre d’équipements actifs. L’association permet aussi de créer une nouvelle fiche avec le propriétaire présélectionné.
- Chaque liste déroulante ouvre une recherche intégrée au menu. Aucun champ de recherche supplémentaire n’est affiché au-dessus. Les menus sont utilisables au clavier (flèches, Entrée, Échap) et sur mobile ; les valeurs des formulaires restent conservées dans les champs natifs.
- Les dates manuelles ne demandent aucune justification. Leur auteur et leur confirmation restent conservés ; la mention technique « Échéance saisie manuellement » est enregistrée automatiquement. L’historique est replié dans la fiche.
- Les nouveaux rapports suivent la séquence 1, 2, 3 dans l’espace de données, après le plus grand numéro numérique enregistré. Les anciennes références et les rapports existants restent inchangés. Le contrôle de révision Supabase rejette une écriture concurrente obsolète : actualiser les données avant de réessayer. Une création annulée ne réserve pas un numéro.

Validation : tests navigateur sur données fictives (création, périodicité, variante, recherche, affectation, rapports successifs et persistance), régression propriétaires/nomenclature/rapports et génération PDF. Aucune donnée de production utilisée ou modifiée par les tests.

## Fiche propriétaire

La fiche conserve l’adresse e-mail et propose équipe (A, B, C, D, E, Jour), service (IT, HSE, Métrologie, RH), secteur (A1, A2, B1, B2, B3), et sous-secteur / zone (DMCR, Yuzer sous B2). Les champs sont facultatifs. Changer de secteur efface le sous-secteur incompatible lors de l’enregistrement. La recherche des propriétaires accepte aussi leur affectation. Ces informations sont enregistrées dans le profil existant `ownerContacts`, dans le même stockage local ou Supabase que les coordonnées ; aucune migration SQL supplémentaire nécessaire. Les affectations des équipements restent indépendantes de la fiche propriétaire. Les anciens profils sans ces champs restent compatibles.

Le nom du propriétaire est modifiable directement dans sa fiche. Le renommage met à jour ses associations actuelles, conserve ses coordonnées et enregistre l’ancien nom dans un historique. Un nom déjà utilisé par un autre propriétaire est refusé. Les contrôles et leurs documents/snapshots historiques restent inchangés.

## Plusieurs propriétaires pour un équipement

La fiche équipement affiche les propriétaires en haut à gauche. Chaque nom ouvre sa fiche. « Associer un propriétaire » ouvre un menu avec recherche et permet d’ajouter ou de retirer une association. Depuis la fiche propriétaire, associer un matériel déjà affecté ajoute une personne après confirmation, sans remplacer les précédentes. Le matériel apparaît dans la fiche de chacune des personnes associées. Renommer une personne actualise également les associations supplémentaires.

Le champ historique `owner` est conservé, complété par `additionalOwners` ; ces données sont stockées dans la sauvegarde JSON existante et dans le snapshot Supabase, sans nouvelle migration SQL. Retirer le premier propriétaire conserve les autres associations. Les contrôles et leurs documents historiques restent inchangés ; les nouveaux rapports reprennent tous les noms associés au moment du contrôle. Aucun rôle « chef d’équipe » ou « responsable secteur » n’est imposé.

Les prévisualisations des rappels incluent les adresses des propriétaires associés, avec détection des adresses identiques et indication des adresses manquantes. Il n’y a toujours aucun envoi automatique. Avant activation, les rôles, la visibilité des adresses, le mode d’envoi (individuel ou copie) et les règles de destinataires devront être définis. L’application n’associe jamais un responsable à partir du seul secteur ou de l’équipe.

## Classement des échéances dans Matériel

Les blocs sont cliquables et filtrent les mêmes catégories que la liste : En retard (date limite dépassée), À contrôler bientôt (un mois calendaire avant l’échéance jusqu’à la date limite incluse), À jour (échéance au-delà d’un mois), Échéance à définir (aucune échéance exploitable), et Archivés. Les quatre catégories d’échéance sont disjointes et couvrent tout le parc actif. Le bloc Équipements actifs montre l’ensemble.

Le compteur « Sans contrôle » est retiré de ce classement : un équipement peut avoir une date MemoryFlow et une échéance confirmée sans contrôle détaillé avec résultat et vérificateur. Il est donc classé selon son échéance, sans inventer de contrôle réalisé. Le résultat et l’historique des contrôles restent distincts, et le KPI des échéances non dépassées continue à inclure les échéances proches non échues.

## Contrôleurs

L’onglet VGP → Contrôleurs propose un annuaire avec recherche par nom ou e-mail, une fiche modifiable et la liste des contrôles associés. Les anciens noms de vérificateurs sont repris automatiquement dans des fiches, sans modifier les contrôles historiques. Le choix du contrôleur dans chaque formulaire de VGP est désormais une liste avec recherche provenant de cet annuaire. L’ajout rapide depuis le formulaire crée également une fiche, à compléter dans cet onglet.

Chaque fiche possède un identifiant stable. Les nouveaux contrôles conservent `verifierId`, le nom déclaré et un snapshot du nom/e-mail ; renommer une fiche ne réécrit aucun contrôle ni PDF existant. Les alias historiques permettent de retrouver les anciens contrôles qui ne disposaient pas d’identifiant de contrôleur. Les noms déjà utilisés sont refusés et la sélection d’un contrôleur reste obligatoire pour enregistrer une VGP.

Une signature peut être importée en PNG, JPEG ou WebP, jusqu’à 1 Mo. L’image est vérifiée, prévisualisée et conservée dans la fiche ; elle peut être remplacée ou retirée. Elle n’est pas apposée automatiquement sur un rapport et ne constitue pas une approbation de chaque contrôle. Le workflow d’approbation des rapports reste à définir avant une future utilisation de cette signature.

Les fiches et images sont conservées dans `controllerProfiles`, dans le stockage local ou le snapshot Supabase existant, sous les règles d’accès de l’espace. Aucune nouvelle migration SQL n’est nécessaire. L’ancienne liste `verifiers` reste maintenue pour la compatibilité. Aucune donnée de démonstration n’est réinitialisée et aucun envoi de mail n’est activé.

Le cercle KPI affiche son pourcentage en bleu sur fond blanc. La formule des échéances non dépassées / parc actif reste inchangée ; lorsqu’il n’y a aucun équipement actif, il indique « Non applicable ».

Dans « Propriétaires de l’équipement », le bouton « Créer un propriétaire » permet de saisir son nom et un e-mail facultatif, puis de créer sa fiche et de l’associer en un seul enregistrement. Les propriétaires déjà associés sont conservés. Les doublons de noms sont refusés ; équipe, service et secteur peuvent être complétés ensuite dans la fiche propriétaire.
