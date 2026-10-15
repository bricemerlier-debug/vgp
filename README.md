## Import des rapports APAVE

Analyse locale du PDF original, aperçu modifiable, stockage privé unique et liens vers les pages des équipements : [fonctionnement, activation et tests](docs/APAVE.md). Aucun import sans validation humaine.

## Correction des imports interrompus par Supabase

Le correctif SQL 004 optimise les grands enregistrements sans supprimer les données ni désactiver les protections. Il doit être appliqué dans SQL Editor du projet existant : [étapes](docs/CORRECTIF-DELAI-SUPABASE.md). Le message de délai est désormais expliqué en français dans le site.

## Reprise des dernières dates MemoryFlow

Le CSV des contrôles peut désormais être associé aux fiches existantes depuis ⚙ > Données, avec aperçu, confirmation des dates/périodicités, contrôle des identifiants et signalement des anomalies. Les dernières dates déclarées restent séparées des contrôles avec résultat/vérificateur. Voir [le guide](docs/REPRISE-DATES-MEMORYFLOW.md).

## Conversion et téléchargement Excel depuis votre PC

Une [page de conversion](conversion-excel.html) prépare le classeur directement dans le navigateur sans envoyer de données à Supabase/GitHub. Voir les [consignes](docs/CONVERSION-EXCEL.md).

# Noms standardisés

Types, variantes et reprise des anciens noms par groupes : voir [le guide](docs/NOMS-STANDARDISES.md). Cette fonctionnalité est publiée sur le site : types et variantes dans les fiches, puis standardisation par groupes dans les paramètres.

# Mise en service autorisée

Voir [le guide d’activation](docs/MISE-EN-SERVICE.md) : protection SQL Supabase nécessaire pour activer l’enregistrement, puis import de l’export Excel MemoryFlow. Aucune donnée réelle n’a été utilisée dans les tests ou ajoutée au dépôt.

Le [guide étape 1](docs/ETAPE-1.md) détaille les calculs et les essais fictifs.

## Accueil de pilotage VGP

Le logo Goodyear et le menu **Accueil** ouvrent le tableau de bord : avancement des contrôles prévus dans le mois, retards, échéances des 7 prochains jours, dates à définir, agenda hebdomadaire et équipements prioritaires avec accès direct au contrôle. Les résultats nécessitant une action (réparable, à jeter) et les exclusions pour perte restent distincts de l’avancement. Les archives sont exclues des indicateurs actifs ; un équipement neuf ne reçoit aucun contrôle réalisé fictif. Les écrans utilisent désormais le libellé **ID**.

En mode Supabase, les données sont vérifiées automatiquement toutes les 20 secondes, après chaque enregistrement depuis cet appareil et au retour sur la page. L’heure de dernière réception et les erreurs réseau sont visibles. L’actualisation attend la fin des dialogues et des saisies non enregistrées. Les liens `#home`, `#material`, `#kpi` permettent de retrouver l’écran après rechargement.

Le build `python tools/build.py` produit un HTML autonome **local** pour préserver les tests et copies hors ligne ; utilisez `python tools/build.py --cloud` uniquement si vous souhaitez y intégrer la configuration publique Supabase. GitHub Pages utilise toujours `cloud-config.js`, inchangé par ce choix.

## Présentation Goodyear Amiens

Le site porte le nom « Vérification générale périodique Goodyear Amiens », avec une présentation bleu et jaune. Le logo officiel importé dans **⚙ > Rapports** apparaît aussi au centre de l’en-tête. En son absence, le nom GOODYEAR est affiché en texte ; aucune image de logo officiel n’est inventée. Les sauvegardes et la clé locale restent inchangées.

## Connexion Supabase

Le [guide Supabase](docs/SUPABASE.md) décrit le stockage actuel, les scripts SQL, Auth/RLS, la migration sans suppression du local, l’import Excel et les futurs rappels J-30/J-14/J-7/J0. La connexion utilise les valeurs publiques de `cloud-config.js` ; sa configuration existante est conservée. Les rappels VGP restent désactivés.

# Métrologie — prototype

Application française sans dépendance ni installation nécessaire sur le PC.

## Essayer

Téléchargez `prototype-vgp.html` puis ouvrez-le avec Edge ou Chrome. Les deux équipements de départ sont fictifs. Ajoutez un équipement avec un identifiant unique, choisissez 3, 6, 9 ou 12 mois, et renseignez éventuellement le dernier contrôle avec son justificatif. Depuis sa fiche, ajoutez d’autres contrôles ou ouvrez un compte rendu, puis utilisez « Imprimer / enregistrer en PDF » et choisissez le PDF dans la fenêtre d’impression.

Les données et pièces jointes sont réellement conservées dans le stockage local du navigateur, pas sur un serveur. Exportez régulièrement une sauvegarde JSON, qui inclut les justificatifs. Un changement de navigateur, d’adresse ou de chemin de fichier, un effacement du stockage ou la navigation privée peuvent rendre les données indisponibles. Les sauvegardes peuvent contenir des données confidentielles : utilisez les emplacements autorisés par votre entreprise.

PDF/images limités à 1 Mo par pièce ; stockage total limité par le navigateur (souvent environ 5 Mo). Une erreur de stockage est signalée, sans annoncer un enregistrement réussi. Le prototype est destiné aux essais, pas à l’ensemble du parc réel.

Les notifications sont des alertes visuelles, sans e-mail, SMS ni tâche en arrière-plan. Dans ce fichier autonome local, les comptes et le partage centralisé sont désactivés. Le site connecté utilise Supabase Auth ; les niveaux 1 à 3 et les sauvegardes automatiques restent à définir.

## Échéances

Une échéance nécessite un contrôle exploitable et une périodicité validée, ou une première date explicitement justifiée. Sans cela : **Situation à vérifier**. Aucune validité depuis la création informatique. Le résultat du contrôle reste distinct. Les modifications sont tracées, et le cycle déjà validé est conservé lors d'un changement de périodicité. Voir les règles et limites dans [ETAPE-1.md](docs/ETAPE-1.md).

## Développement dans le cloud

Depuis `/workspace/vgp`, lancer `python tools/dev_server.py`, puis utiliser `http://localhost:8001`. Le rechargement automatique attend la fermeture des fenêtres de saisie. Pour les tests historiques sur le port 8000, lancer `python -m http.server 8000 --bind 127.0.0.1`. Le serveur sert les fichiers, sans base de données. Pour reconstruire le fichier autonome : `python tools/build.py`.

Tests : `node --test tests/domain.test.mjs`. Test navigateur avec serveur lancé : `python tests/browser.py` (Playwright et `/usr/bin/chromium` requis, déjà présents dans l’environnement utilisé). Les essais utilisent un profil temporaire et ne modifient pas vos données.

Avant utilisation réelle : définir avec l’informatique l’hébergement HTTPS, l’authentification et les droits, le stockage sécurisé des rapports et les sauvegardes ; valider les périodicités et le traitement des résultats.

## Champs de la fiche

Le numéro interne est obligatoire et unique. Le numéro de série est facultatif, mais unique lorsqu’il est renseigné. Les doublons sont signalés en rouge pendant la saisie et bloquent l’enregistrement, y compris en modification et à l’import. La comparaison ignore les majuscules/minuscules et les espaces au début et à la fin ; les zéros initiaux restent significatifs (1234 et 01234 sont distincts). Plusieurs fiches sans numéro de série sont autorisées.

Secteurs : A1, A2, B1, B2, B3. Équipes : A, B, C, D, E, Jour. Le propriétaire est une liste provisoire, initialement vide ; « Ajouter un propriétaire » permet de la compléter sans inventer de propriétaires. Ces champs sont visibles dans les fiches et comptes rendus et inclus dans les recherches et sauvegardes. Les anciennes sauvegardes sont compatibles : les nouveaux champs sont initialisés vides, sans suppression des contrôles.

Test complémentaire avec serveur actif : `python tests/equipment_fields.py`.

## Navigation

Le bouton à trois barres en haut à gauche ouvre le menu « Matériel » / « Propriétaires ». Matériel réinitialise les filtres et affiche tous les équipements. Propriétaires affiche les propriétaires enregistrés, leur nombre d’équipements et un accès au matériel associé. Les équipements sans propriétaire sont regroupés séparément. Les propriétaires sans matériel restent visibles. La navigation fonctionne sur ordinateur et mobile ; Échap ou un clic hors du panneau ferme le menu. Test : `python tests/navigation.py` avec serveur actif.

## KPI visuels VGP

Le principal indicateur est désormais **VGP à jour** : échéances validées non dépassées / tout le parc actif suivi, situations inconnues comprises. Le résultat et les anomalies restent séparés. Les contrôles introuvables ne comptent pas comme réalisations. Les exclusions et archives sont visibles séparément. Tous les calculs sont détaillés dans [ETAPE-1.md](docs/ETAPE-1.md).

## Archivage, désarchivage et documents

**Évolution étape 1 :** « Déclarer introuvable » archive directement avec événement de recherche, sans VGP. Le matériel retrouvé revient à vérifier sans nouvelle validité. Les parcours de documents signés décrits ci-dessous restent conservés pour la mise au rebut et les opérations existantes.

Depuis une fiche, « Archiver » propose Équipement perdu ou Mis au rebut. Renseignez la date et le demandeur, préparez la demande, puis générez le document à signer. Imprimez-le ou enregistrez-le en PDF et faites-le signer. Joignez sa version signée (PDF/image, 1 Mo maximum), le nom de l’approbateur, la date d’approbation et confirmez la présence de la signature. La validation change alors le statut. Avant cette validation, l’équipement reste actif. La demande est sauvegardée et peut être reprise ou annulée ; annuler une demande ne change pas le statut. La génération seule ne vaut pas approbation.

Les équipements archivés restent dans la liste, en gris, avec le statut Archivé et le suivi suspendu. Leurs numéros interne et de série restent réservés. Leurs contrôles et documents restent disponibles. Ils sont exclus des échéances actives, des contrôles à faire et du dénominateur du pourcentage KPI ; les contrôles historiques restent dans les compteurs de contrôles/actions réalisés. Le filtre Archivé permet de les retrouver.

« Désarchiver » suit le même parcours d’approbation signée, avec un motif libre et un nouveau contrôle obligatoire daté à partir de la demande. L’équipement reste archivé jusqu’à validation de l’ensemble ; le nouveau contrôle est ajouté à l’historique uniquement à ce moment. Le prototype ne décide pas d’une autorisation de remise en service ni d’une conformité : le résultat du nouveau contrôle reste visible indépendamment du statut administratif.

Chaque opération validée conserve un historique, le motif, les dates, les noms déclarés, une copie des informations de l’équipement au moment de la demande et le document signé téléchargeable. Ces données sont incluses dans les sauvegardes. Ce stockage local n’est pas un journal inviolable. Le prototype ne vérifie pas l’authenticité de la signature, le contenu du document ou l’identité/droits de l’approbateur ; il impose une pièce jointe et une confirmation déclarative.

Chaque contrôle apparaît avec sa date dans la fiche. « Télécharger le PDF » génère directement le compte rendu à partir du contrôle enregistré, sans installation ni dépendance externe. Les observations longues sont réparties sur plusieurs pages. Le justificatif d’origine est accessible séparément. La localisation, l’affectation et le propriétaire du compte rendu sont ceux de la fiche actuelle, explicitement indiqués comme tels.

Tests complémentaires : `python tests/archive.py` (serveur actif). Les PDF ont été vérifiés avec `pdfinfo` et `pdftotext`, notamment les accents et les documents de plusieurs pages.

## Lancement local avec rechargement automatique (Windows)

1. Télécharger `vgp-developpement-local.zip` et extraire le dossier `vgp-local` dans un emplacement autorisé par l’entreprise.
2. Python 3 doit être disponible. Dans un terminal, vérifier avec `py --version`. Si Python est absent, demander à l’informatique son installation depuis python.org ou son catalogue logiciel. Python est le programme qui exécutera le petit serveur ; l’installation ajoute un interpréteur et éventuellement une commande au PATH, sans installer de base de données ou de service permanent. Aucun paquet supplémentaire n’est requis. Aucun programme n’est installé automatiquement par ces fichiers.
3. Double-cliquer sur `start-local.bat`, ou ouvrir un terminal dans `vgp-local` et lancer `py -3 tools/dev_server.py`. Sur macOS/Linux : `python3 tools/dev_server.py`.
4. Ouvrir `http://localhost:8001` dans Edge ou Chrome et garder le terminal ouvert. Ctrl+C arrête le serveur. Relancer la même commande pour reprendre.

Le serveur ne se connecte qu’à la boucle locale (127.0.0.1), sans publication sur Internet ni accès tablette. Il sert uniquement les fichiers de l’application, jamais le contenu de .git. Aucun build n’est nécessaire. Les changements de HTML, CSS ou JavaScript sont détectés chaque seconde. La page est rechargée automatiquement une fois les fenêtres de saisie fermées. Les champs de recherche peuvent être réinitialisés au rechargement.

Le serveur peut rester lancé après une modification des fichiers de l’application ; si vous modifiez le serveur Python lui-même, redémarrez-le. Si le port est occupé, fermez l’autre serveur puis relancez ; ne changez pas d’adresse simplement pour contourner ce conflit, car le stockage du navigateur dépend de l’adresse et du port.

Les équipements, contrôles, documents et demandes d’archivage enregistrés restent dans localStorage sous la clé stable `vgp-prototype-v1`. Une sauvegarde existante est chargée avant toute création d’exemples. Un parc enregistré vide reste vide. Un stockage illisible n’est pas remplacé par les démonstrations : les enregistrements sont bloqués jusqu’à l’import explicite d’une sauvegarde valide. Le rechargement du code et le redémarrage du serveur ne suppriment aucune donnée. Cela reste un stockage de navigateur : utiliser le même navigateur/profil, éviter la navigation privée et exporter régulièrement.

Pour migrer depuis le fichier HTML ou une autre adresse : exporter sur l’ancien prototype, puis importer sur `http://localhost:8001`. Garder la même adresse ensuite : localhost et 127.0.0.1 sont deux origines distinctes.

Les modifications faites dans l’environnement cloud ne sont pas automatiquement synchronisées avec votre PC. Copier les nouveaux fichiers sources dans le dossier local existant (sans changer l’adresse ou effacer le navigateur) déclenche le rechargement ; une synchronisation des fichiers devra être mise en place séparément si souhaitée.

Test automatisé : `python tests/live_reload.py`. Il démarre un serveur temporaire sur le port 8002 et un profil navigateur isolé ; il vérifie le rechargement réel, la protection des formulaires, le redémarrage et la persistance des équipements/contrôles.

## Création sans contrôle antérieur

La fiche est créée sans VGP réalisée ni échéance artificielle. Elle affiche **Situation à vérifier** jusqu'à une échéance justifiée ou un contrôle et une règle de suivi validée. Après enregistrement, elle apparaît dans la liste, même si les filtres précédents la masquaient. Tests : `python tests/creation.py`.

## Filtres et zones

Les compteurs Équipements, En retard, À venir et Sans contrôle sont cliquables : ils retirent les filtres précédents puis montrent tous les équipements de la catégorie sélectionnée. Les filtres équipe, secteur, zone, échéance et recherche peuvent ensuite se combiner. Le bouton Réinitialiser les filtres revient à toute la liste. Le nombre de résultats est affiché.

Tri disponible par numéro interne, équipe, secteur puis zone ou zone. La fiche distingue le secteur et sa zone : pour le moment DMCR et Yuzer sont disponibles uniquement sous B2. Changer le secteur vers un autre secteur efface la zone sur la fiche lors de l’enregistrement. Les anciens équipements et sauvegardes restent compatibles avec une zone vide. La zone figure dans la liste, les fiches et les comptes rendus.

Test navigateur : `python tests/filters.py` avec serveur sur le port 8000.

## Essais dans un aperçu isolé (ChatGPT)

Un aperçu peut refuser l’accès à localStorage. Dans ce cas, le prototype active un mode d’essai en mémoire, affiche un avertissement et permet réellement de créer des équipements et d’ajouter des contrôles pendant la session. Les créations apparaissent dans la liste et les contrôles dans l’historique, avec leur PDF disponible. Ce mode ne garantit aucune persistance après rafraîchissement ou fermeture : exporter puis réimporter une sauvegarde est nécessaire. Les messages d’enregistrement indiquent « pour cette session uniquement ». Une sauvegarde existante illisible reste protégée, sans remplacement automatique.

Hors aperçu, quand localStorage fonctionne, la sauvegarde durable dans le navigateur reste active. La copie des données utilise un repli compatible si structuredClone est absent. Les erreurs de sauvegarde sont affichées directement dans les formulaires équipement et contrôle.

Test : `python tests/preview.py` sert le fichier autonome dans une iframe sandbox sans allow-same-origin, donc sans accès à localStorage, puis vérifie création, enregistrement du contrôle, PDF et export. Il simule les restrictions d’un aperçu ; ce n’est pas un test de l’interface ChatGPT réelle.

## Métrologie : navigation par activité

Le site s’appelle Métrologie. Dans le menu, VGP regroupe Matériel, Propriétaires et KPI. Contenant regroupe Matériel et KPI : ces deux pages sont pour l’instant des espaces à compléter, sans gestion de contenants ni indicateurs calculés. Les équipements VGP, leurs contrôles et leurs sauvegardes gardent le même format et la même clé de stockage.

## Identifiants VGP et séparation des archives

VGP et Contenant sont deux activités distinctes ; les pages Contenant n’utilisent pas le parc ou les KPI VGP. Une fiche VGP reçoit désormais un ID VGP numérique automatique, distinct du numéro interne d’équipement saisi et de son numéro de série. Cet ID est conservé au fil des modifications, archivages et désarchivages, et inclus dans les sauvegardes. Les anciennes fiches reçoivent un ID lors de la migration sans suppression des données. Le compteur porte sur tout le parc VGP, archives comprises, pour ne pas réattribuer leur numéro. Il est local à ce jeu de données et ne constitue pas un identifiant partagé entre utilisateurs.

Matériel VGP propose Actifs et Archivés avec des compteurs séparés. Par défaut seuls les actifs sont affichés. Le total Équipements actifs exclut toutes les archives ; une carte Archivés affiche leur nombre et ouvre l’onglet correspondant. Les archives conservent leur historique et restent grisées dans leur vue. Lors de la validation d’un archivage ou désarchivage, la liste bascule sur la vue correspondante. Les KPI d’échéance restent calculés sur les actifs et les comptes de contrôles historiques restent conservés.

## Fiche VGP simplifiée

Le formulaire utilise Nom, numéros interne et de série, famille, localisation et associations. Les anciennes catégories et affectations sont conservées. Le dernier contrôle facultatif se déplie sur demande ; sans contrôle passé, aucune réalisation ni date périodique n'est inventée.

## Fiche propriétaire / employé et association

Depuis Propriétaires, cliquer sur la personne ou sur Ouvrir la fiche affiche son matériel VGP, actifs et archives séparés dans les compteurs. Chaque équipement peut être ouvert directement. Le bouton Associer un équipement existant présente les matériels VGP actifs, avec recherche et propriétaire actuel. Un équipement déjà associé à cette personne est indiqué et ne peut pas être ajouté deux fois. S’il appartient à une autre personne, la réaffectation exige confirmation et le retire de la fiche précédente. Les associations utilisent le même champ propriétaire que le formulaire équipement et sont incluses dans les sauvegardes. Les archives sont consultables sur la fiche, mais ne sont pas proposées pour de nouvelles associations. Aucun matériel Contenant n’est utilisé.

Test : `python tests/owner_association.py` avec serveur sur le port 8000.

## E-mail propriétaire et rappels (simulation)

La fiche propriétaire permet d’enregistrer une adresse e-mail, incluse dans les sauvegardes. Le calendrier calcule quatre rappels pour chaque équipement VGP actif avec une échéance : un mois calendaire avant (jour ajusté en fin de mois), 14 jours avant, 7 jours avant, puis le jour de l’échéance. Chaque message peut être prévisualisé avec le destinataire, l’identifiant du matériel et sa date limite. Les dates sont recalculées après chaque contrôle et les associations sont relues : aucun calendrier périmé n’est stocké. Les archives ne génèrent aucun rappel. Les dates antérieures sont signalées comme passées, sans prétendre qu’un envoi a eu lieu.

Aucun e-mail n’est envoyé, aucun traitement d’arrière-plan n’est actif et aucun journal d’envoi n’est simulé comme réel. Le message du jour de l’échéance contient une consigne interne proposée de suspension d’usage, explicitement à valider par l’entreprise. Ce message ne crée pas une règle réglementaire ni un blocage automatique du matériel dans le prototype.

L’entreprise utilise Outlook / Microsoft 365. Pour activer les envois réels : définir avec l’informatique la boîte expéditrice, les droits d’envoi Microsoft 365 (par exemple via Microsoft Graph), un serveur avec base persistante et un traitement planifié en fuseau Europe/Paris. Prévoir des identifiants d’envoi uniques par équipement/échéance/type de rappel pour éviter les doublons, le recalcul après contrôle/réaffectation/archivage, les reprises d’erreurs et un historique réel des envois. Les credentials devront être fournis via les paramètres sécurisés du futur hébergement, jamais dans le code ni la conversation. Le prototype local ne peut pas assurer l’envoi quand le navigateur est fermé. Le canal Microsoft 365 est retenu ; sa connexion et l’hébergement ne sont pas configurés.

Tests : `node --test tests/reminders.test.mjs` et `python tests/owner_email.py` avec serveur sur le port 8000.

## Prochaine échéance automatique ou manuelle

Le calcul automatique nécessite la validation de la périodicité et un contrôle exploitable. Une date manuelle exige origine, justification, auteur et confirmation. Les anciennes dates restent conservées comme informations à valider. La recherche Matériel retrouve ID, numéro interne et nom, sans sensibilité à la casse et aux accents.

## Statuts d’échéance harmonisés

**Échéance à plus d'un mois** : limite validée lointaine. **À faire** : un mois calendaire avant la limite, jusqu'à son jour inclus. **En retard** : lendemain et au-delà. **Situation à vérifier** : date non exploitable/non validée ou équipement retrouvé à contrôler. Ces statuts ne certifient pas la conformité.

## Commentaires équipement

Les commentaires existants sont conservés et modifiables. Une nouvelle fiche reçoit « Fiche créée le JJ/MM/AAAA », sans inventer une date de mise en service. Le fil de commentaires datés et attribués reste prévu pour une étape suivante.

## KPI mensuels sur 12 mois

La courbe présente les réalisations **dans les délais** par mois de l'échéance, avec réalisations tardives, retards non réalisés et exclusions distincts. Le registre conserve les échéances historiques après archivage et modification de périodicité. Une réalisation supplémentaire sur un matériel ne compense pas une échéance manquante sur un autre. Sans échéance : Non applicable. Les anciens contrôles sans échéance associée sont signalés et restent consultables. Voir [ETAPE-1.md](docs/ETAPE-1.md).

## Listes depuis les KPI et motifs d’archivage

Les cartes Parc actif, Jamais contrôlés, Contrôles à faire, Contrôles réalisés et Actions réalisées sont cliquables. Les légendes et le pourcentage de couverture ouvrent aussi les listes ; les barres d’échéances et de résultats ouvrent leur catégorie. Les listes permettent d’ouvrir les fiches et les échéances À définir restent éditables. Les compteurs d’historique affichent les contrôles individuels, archives comprises, plutôt qu’une liste d’équipements dédupliquée.

L’archivage approuvé distingue désormais Mis au rebut (fond gris foncé, texte clair) et Équipement perdu (violet), avec un libellé visible en plus de la couleur. Le motif est lu depuis le dernier archivage validé, sans modifier les historiques. La distinction est visible dans Matériel, les fiches propriétaires et les listes KPI. Dans Archivés, le filtre Motif d’archivage sépare les deux cas. Désarchiver restaure l’apparence active.

Test : `python tests/kpi_lists.py` avec serveur sur le port 8000.

## Paramètres de mails (roue dentée en haut à droite)

Le menu ⚙ contient Mails. Cette page permet de personnaliser l’objet et le corps des quatre modèles (un mois, deux semaines, une semaine, échéance) et d’afficher un aperçu avec un équipement actif. Les champs automatiques sont `{{nom_equipement}}`, `{{numero_interne}}`, `{{id_vgp}}`, `{{nom_proprietaire}}`, `{{date_controle}}`, `{{secteur}}`, `{{zone}}`. Ils sont remplacés avec les valeurs de la fiche au moment de l’aperçu, sans exécution de code ni interprétation HTML. Les champs inconnus sont signalés lors de l’enregistrement. Les modèles sont inclus dans les sauvegardes et les aperçus de rappels sur les fiches propriétaires les utilisent.

Aucun envoi réel n’est activé. Pour l’automatisation Microsoft 365, prévoir avec l’informatique une boîte expéditrice autorisée, un traitement côté serveur avec stockage partagé, une connexion Microsoft Graph adaptée et un historique d’envoi avec prévention des doublons. Aucune clé ni aucun mot de passe n’est demandé dans les modèles ou dans le chat. Un mail type peut être transmis sous forme de texte avec des noms fictifs puis transformé en modèle à variables.

Test : `python tests/mail_templates.py` avec serveur sur le port 8000.

## Contrôle de mise au rebut et présentation du matériel

Une nouvelle mise au rebut exige, en plus de l’approbation signée, la saisie du contrôle : date, intervenant et résultat Mauvais état — à jeter. La validation enregistre le contrôle dans l’historique avec son compte rendu PDF, l’associe à l’archivage et maintient l’équipement archivé. Une perte ne crée pas de contrôle automatique. Les anciennes mises au rebut sans contrôle associé affichent « Mis au rebut — contrôle à compléter » et proposent un bouton pour renseigner les informations réelles, sans fabriquer une date ni un intervenant ; l’archive reste conservée.

La liste présente le nom en première ligne avec la taille de police principale, puis le numéro interne, le numéro de série et l’ID VGP en petites lignes compactes. Une série absente reste explicitement Non renseigné. La même présentation est utilisée dans les listes propriétaires et les listes KPI.

Test : `python tests/scrap.py` avec serveur sur le port 8000.

## Rapports PDF structurés et vérificateurs

Le rapport A4 utilise un en-tête bleu/jaune, quatre sections (identification, vérification, observations, conclusion), une référence unique, une zone de signature et un pied de page. Le numéro de rapport `VGP-date-UUID` est enregistré sur le contrôle et réutilisé pour chaque téléchargement. Les nouveaux contrôles conservent les informations de l’équipement au moment de la vérification, pour éviter qu’un changement de nom ou de zone modifie un ancien rapport. Les contrôles antérieurs sans copie de fiche sont explicitement signalés comme utilisant les informations actuelles. Les longs commentaires sont répartis sur plusieurs pages. Le code identifie le rapport ; ce n’est pas une signature cryptographique ou une preuve d’identité.

Le champ Vérificateur est une liste de suggestions avec saisie de nom et bouton Ajouter un vérificateur. Il est obligatoire pour un contrôle réalisé, y compris les contrôles de mise au rebut ou désarchivage ; les nouveaux noms sont conservés et proposés ensuite. Les noms historiques restent disponibles. La sélection d’un nom n’est pas une authentification utilisateur.

Les conclusions dépendent du résultat : Bon état = déclaration du vérificateur limitée au constat et aux observations ; Réparable = mauvais état avec réparation nécessaire, sans avis favorable ; À jeter = orientation vers mise au rebut, sans avis favorable ; Introuvable = aucun examen possible et aucune conclusion de conformité. Le modèle et les critères applicables doivent être validés par l’entreprise avant usage officiel. Le PDF prévoit une signature manuelle ; le prototype ne signe pas le document à la place du vérificateur.

Le logo officiel Goodyear n’a pas pu être téléchargé : les sites officiels et Wikimedia sont bloqués par le réseau de l’environnement, et les sources GitHub consultées ne le fournissent pas. ⚙ → Rapports permet d’importer un PNG/JPEG officiel fourni par l’entreprise (2 Mo maximum). Il est intégré dans le PDF hors ligne et inclus dans les sauvegardes. Sans import, l’en-tête est un texte GOODYEAR provisoire, explicitement identifié comme tel, pas un faux logo officiel.

Tests : `python tests/reports.py`, `node --test tests/report_pdf.test.mjs`, validation par pdfinfo/pdftotext et intégration du logo par pdfimages.

## Calendrier hebdomadaire et cloche de notifications

Le bandeau gris de la page Matériel est remplacé par un calendrier du lundi au dimanche. La semaine courante est affichée par défaut ; les flèches permettent de changer de semaine et Cette semaine revient au présent. Chaque jour liste les échéances des équipements VGP actifs, avec accès à la fiche. Les contrôles réalisés dont la date prévue a été conservée restent visibles en vert pour suivre le travail de la semaine. Les archives sont exclues.

La cloche près de la roue dentée affiche les échéances À faire (un mois avant) et En retard. Cliquer ouvre la fiche et ferme la liste de notifications. Les alertes sont recalculées après chaque enregistrement ; un contrôle réalisé qui repousse l’échéance hors du mois fait disparaître l’alerte sans suppression manuelle. Un simple ajout historique ancien ne résout pas une échéance toujours due. Le calendrier et les notifications se rafraîchissent aussi chaque minute pour tenir compte du passage des dates.

Aucun mail n’est actuellement envoyé et aucune notification de mail fictif n’est affichée. La cloche le précise. Les confirmations d’envoi ne pourront être ajoutées qu’après connexion réelle de la messagerie Microsoft 365 et du traitement serveur. Les données restent locales au navigateur comme auparavant.

Tests : `node --test tests/weekly.test.mjs` et `python tests/weekly.py` avec serveur sur le port 8000.
