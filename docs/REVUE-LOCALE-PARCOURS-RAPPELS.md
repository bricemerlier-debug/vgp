# Revue locale et publication du site — 16 octobre 2026

État de la recette locale ci-dessous : aucune publication, aucun déploiement, aucune migration Supabase exécutée, aucun compte Microsoft 365 connecté et aucun mail réel envoyé. La publication du site a ensuite été autorisée ; cette autorisation ne concerne ni une connexion de messagerie, ni une activation d’envoi, ni une migration Supabase. Les essais utilisent des équipements et adresses fictifs. Les nouvelles fonctions de rappels s'exécutent uniquement en simulation. Aucun ordonnanceur n'est installé.

## Analyse des éléments existants

| Élément examiné | Constat avant modification | Réutilisation |
|---|---|---|
| `domain.mjs` / `reminders` | Premier rappel à un mois calendaire ; les autres à 14/7/0 jours | Même API et mêmes identifiants de modèles, dates déléguées à `reminder-dates.mjs` |
| `reminder-plan.mjs` | Contrat non connecté : 30 jours exacts mais seulement le premier propriétaire, adresses absentes ignorées | Contrat commun aperçu/file/worker, contacts explicites, anomalies visibles |
| `ownership.mjs` | Propriétaire principal et détenteurs supplémentaires, dédoublonnage des adresses d'aperçu | Affectations existantes préservées ; empreinte des propriétaires pour invalider une ancienne affectation de rappel |
| Modèles et aperçus | Quatre modèles personnalisables, aperçu propriétaire et page Mails | Modèles enregistrés conservés, retour Métrologie présent dans le message du worker ; les coordonnées historiques restent indicatives dans l'ancien aperçu |
| `digest.mjs` | Bilans semaine/mois, KPI et priorités par secteur | Calculs inchangés, explicitement séparés des rappels individuels |
| `supabase/functions/vgp-digests/index.ts` et SQL 005 | Code de fonction de bilans et réservation atomique ; simulation par défaut, chemin Microsoft 365 sous indicateur serveur | Code existant conservé et testé avec `fetch` simulé. Ni déploiement ni activation vérifiés ou revendiqués |
| Navigation et nomenclature | Calendrier dupliqué, imports dans un dialogue de paramètres, deux parcours de standardisation, compteurs réinitialisant les filtres | Modules métier conservés, sections réorganisées et contexte conservé |

## Navigation regroupée après la revue initiale

Le menu sert désormais à changer entre trois espaces : **Matériel et contrôles VGP**, **Plans d’action**, **Personnel**. Des onglets en haut de page donnent accès directement à Liste du matériel / KPI VGP / Planification, et à Contrôleurs / Personnel affecté au matériel. Les onglets Suivi / KPI des plans d’action sont conservés. Aujourd’hui et les outils d’import/administration restent disponibles. Les anciennes URL et les modules métier sont conservés ; `tests/grouped_navigation_browser.py` vérifie les onglets, le clavier, les recherches conservées, les retours fiche, le 5×8 et le mobile sans modifier les données.

## Parcours à examiner

- **Aujourd’hui** (`#home`) : priorités et résumé hebdomadaire, deux équipements au maximum par jour puis accès à Planification. Les états Introuvable et Mis au rebut restent dans l'agenda complet.
- **Matériel** (`#material`) : recherche et liste avant les compteurs. Périmètres « Tous les équipements », « En suivi » (introuvables inclus), « Archives · mis au rebut ». Un clic sur compteur change son statut/périmètre, conserve recherche, secteur, type, variante, propriétaire et tri. Les filtres actifs sont affichés. Au zéro résultat, la recherche dans les archives conserve les critères et annonce explicitement la suppression du filtre de statut.
- **Planification** (`#planning`) : agenda VGP complet et accès au calendrier 5×8 existant (`#shiftCalendar`).
- **Actions correctives** (`#actionKpi`) : suivi et KPI des actions de maintenance existants, sans changer les règles de gravité ni de report.
- **Imports et rapports** (`#imports`) : PDF APAVE, actions APAVE Excel, présentation des rapports. Un seul dialogue d'import, sans dialogue de paramètres dessous.
- **Pilotage** (`#kpi`) : calculs VGP existants.
- **Référentiels / administration** (`#administration`) : propriétaires, contrôleurs, nomenclature, bilans/rappels et migrations historiques distinctes.

La nomenclature utilise une page (`#naming`) et trois onglets accessibles au clavier : Propositions / Catalogue / Correspondances. Les propositions automatiques et les groupes utilisent toujours leurs fonctions métier existantes. Le Catalogue choisit le type/variante cible des groupes ; Correspondances contient les règles exactes et la sélection par noms historiques. La validation, la confirmation et la protection contre les données modifiées entre aperçu et application sont conservées. Aucun renommage ne change propriétaire, périodicité ou échéance. Les anciennes URL restent acceptées.

Le formulaire d'un équipement introuvable change son titre, son introduction et son bouton en « Déclarer introuvable ». Il appelle toujours le workflow existant de déclaration de perte ; aucune VGP favorable n'est ajoutée.

## Simulation des contacts et des rappels

Ouvrir **Référentiels / administration → Bilans et rappels · simulation**. Les préférences et aperçus de **bilans** sont au-dessus du laboratoire de **rappels individuels**. Les bilans ne passent pas par cette file de rappels.

Les contacts de simulation possèdent un UUID permanent, un type personne/service/société, un statut à vérifier/confirmé. Les affectations ont un statut et un rôle responsable principal/détenteur supplémentaire/escalade. Elles sont enregistrées **dans une base IndexedDB séparée**, par espace et utilisateur connecté ; elles ne sont pas écrites dans Supabase et ne remplacent pas les propriétaires existants. Aucun nom historique n'est analysé pour trouver une personne ; aucun doublon de contact n'est fusionné. Une adresse partagée produit au plus un message par étape et reste signalée. Les équipements sans contact, sans responsable confirmé, sans adresse ou sans échéance sont tous listés dans « Contacts et échéances à traiter ».

La base locale est un outil d'essai sur le poste : elle n'est ni une file partagée ni une protection d'accès au niveau serveur. Ne pas y utiliser d'adresses ou de données réelles pour cette recette. Le partage des contacts sera un chantier serveur soumis à l'IT, avec reprise explicite des affectations confirmées.

- **Actualiser l'aperçu** : aucune mise en file.
- **Préparer la file de simulation** : persistance locale des étapes ; aucun envoi.
- **Exécuter la simulation du jour** : transport fictif, succès/panne réseau/réponse inconnue. Aucun HTTP vers Microsoft.
- « SIMULÉ — aucun mail envoyé », « Échec simulé », « Annulé — simulation » et « Résultat simulé incertain » sont distincts. Aucun de ces états n'est « Envoyé ».

Les dates civiles Europe/Paris utilisent une seule fonction : J-30 = exactement 30 jours, J-14 = 14 jours, J-7 = 7 jours et J0 = jour de l'échéance. Les changements d'heure ne font pas varier ces dates. Le seuil visuel « À contrôler bientôt » du matériel reste volontairement sa règle métier existante d'un mois calendaire ; ce seuil n'est pas une date d'envoi.

La clé unique est espace + équipement + cycle de contrôle + adresse destinataire normalisée + étape. Les contacts gardent leur identifiant stable ; la clé de livraison représente l'adresse effective. Changer l'adresse annule les anciennes étapes et prépare celles du nouveau destinataire vérifié. Plusieurs contacts utilisant la même adresse ne produisent pas de doublon. Changer une affectation à adresse identique peut réviser une étape jamais tentée en conservant son annulation dans le journal ; aucune étape déjà traitée ou incertaine n'est rejouée automatiquement.

Le worker relit les données à la préparation, à la réservation et immédiatement avant le transport. Contrôle, archivage, nouvelle échéance ou affectation non confirmée annulent les rappels obsolètes. Une ancienne échéance restée ouverte malgré un contrôle plus récent est signalée pour revue au lieu de relancer un ancien cycle. Les étapes passées ne sont pas rattrapées silencieusement. L'annulation est évaluée lors de la préparation ou de l'exécution manuelle ; il n'y a pas de tâche réelle en arrière-plan.

Trois tentatives maximum pour un échec explicitement certain avant acceptation, avec attente de 1 puis 2 minutes. Une réponse perdue, un délai fournisseur ou une réservation abandonnée passent en état incertain : pas de nouvelle tentative automatique. Le journal conserve les tentatives et les annulations.

## Worker serveur préparé et limites du branchement futur

`reminder-worker.mjs` contient le moteur commun, `server/reminder-store.mjs` fournit une file SQLite persistante avec transaction, index unique et journal append-only. `server/reminders-simulate.mjs` est une commande manuelle **sans accès réseau**, sur un document JSON fictif local. `server/microsoft365-contract.mjs` prépare le format Graph ; sa fabrique de transport réel échoue systématiquement. Aucune variable d'environnement ne permet d'activer un envoi réel dans ce nouveau worker.

Exemple isolé avec Node 24 :

```sh
node server/reminders-simulate.mjs tests/fixtures/reminder-simulation.json /tmp/vgp-simulation.sqlite 2026-10-01T05:00:00Z
```

Répéter cette commande conserve le journal et ne double pas la simulation. Le fichier SQLite doit être conservé hors du répertoire servi par HTTP.

Le branchement Microsoft 365 **reste à réaliser après accord IT**, pas à activer maintenant :

1. Valider les destinataires, le responsable principal, l'escalade, les modèles et la procédure de retour au service Métrologie. Définir qui peut confirmer/modifier un contact.
2. Choisir l'hébergement serveur et le stockage durable partagé. Si Supabase est choisi, préparer une migration additive de contacts/affectations/file/journal : RLS par espace, lecture selon les rôles existants, écriture de la file et du journal réservée au serveur, aucune clé privilégiée dans le navigateur. Les scripts actuels ne sont pas modifiés pour ouvrir des droits.
3. Fournir au worker une lecture serveur faisant autorité du parc et des contacts. Coordonner contrôles/réaffectations et réservations dans la même base/transaction ; tester la concurrence réelle entre ce stockage et Supabase. La simulation valide la relecture avant transport, mais ne revendique pas une transaction atomique entre SQLite et la production Supabase.
4. L'IT crée et restreint l'application Entra et la boîte expéditrice de test : permissions `Mail.Send` minimales limitées à cette boîte, authentification serveur approuvée (certificat/identité gérée selon l'hébergement), secrets uniquement dans le coffre serveur. Aucun secret n'est demandé dans cette version.
5. Implémenter et recetter l'adaptateur Microsoft 365 avec délai borné, corrélation des tentatives et traitement des réponses ambiguës. Graph `202` signifie « accepté par Microsoft », pas preuve de remise au destinataire. Un état futur « envoyé / accepté fournisseur » doit avoir mode réel et accusé fournisseur ; jamais être produit par la simulation. Aucun réessai aveugle après acceptation inconnue.
6. Vérifier journaux, rétention des données et alertes d'échec/adresse absente. Refaire la recette isolée avec une boîte de test autorisée, puis décision explicite d'activation. Ce n'est qu'après cela qu'un ordonnanceur en Europe/Paris et un interrupteur d'arrêt pourront être installés. Les bilans possèdent leur propre calendrier (lundi/premier du mois à 7 h) et leur propre réservation ; ils ne remplacent pas les étapes individuelles.

## Recette locale et preuves

Les tests sont exécutés avec données fictives, appels cloud interceptés ou PGlite local, messagerie simulée. Le parcours principal bloque tout réseau externe. Les captures sont dans `artifacts/local-review/` ; aucune donnée de production n'y apparaît.

| Preuve | Test |
|---|---|
| Actif/archivé, statut+secteur+type+variante, filtres et focus au retour, zéro résultat, absence d'écriture, mobile 390 px, HTML autonome | `tests/workspace_paths_browser.py` |
| Lecteur : lecture et recherche accessibles ; enregistrement refusé ; aucune requête d'écriture | `tests/workspace_reader_browser.py` |
| RLS, lecteurs/éditeurs/non-membres, droits d'écriture et conflits | `tests/database.mjs` (PostgreSQL isolé) |
| Validation humaine et annulation, règles exactes, noms historiques/commentaires, aucune affectation inventée, mois/contrôles conservés, conflit concurrent, groupes | `tests/naming_review_browser.py`, `tests/naming_review_cloud_browser.py`, `tests/nomenclature_browser.py` |
| Filtres dans tous les périmètres et listes de réalisations | `tests/material_naming_filters_browser.py` |
| Couleurs et conservation des équipements introuvables/réformés dans la planification complète | `tests/calendar_status_colors.py`, `tests/weekly.test.mjs` |
| Double exécution/concurrence, persistance, panne/reprises, timeout, contrôle entre réservation et transport, réaffectation, plusieurs détenteurs, adresses absentes, fins de mois/année, DST et J0, refus d'un transport réel | `tests/reminder_worker.test.mjs`, `tests/reminders.test.mjs` |
| Bilans sectoriels distincts et fonction existante avec réseau entièrement simulé | `tests/digest.test.mjs`, `tests/digest_worker.mjs`, `tests/digest_database.mjs` |

Les anciens tests qui reposent sur les fenêtres déplacées ont été adaptés pour les parcours couverts ci-dessus. Cette recette ciblée n'est pas une validation de tous les imports APAVE sur les rapports réels ni une validation de déploiement.
