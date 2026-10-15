## Planning des équipes 5×8

Équipe en poste sur l’accueil, calendrier 7/30 jours, import du classeur officiel et stockage partagé séparé du parc VGP : [activation, format et tests](docs/PLANNING-5X8.md). Référence : « calendrier global », à partir du 01/10/2026 ; sous-équipes exclues.

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

## Fiche équipement et carnet de maintenance

La fiche matériel est une page avec un lien direct `#equipment/IDENTIFIANT`, une synthèse et quatre rubriques : contrôles, carnet de maintenance, commentaires et traçabilité. Le retour conserve les filtres de la liste pendant la session. Les brouillons du carnet restent présents lors d'un changement d'onglet ; une confirmation protège les modifications lorsqu'on quitte la fiche.

Pour le carnet partagé, exécuter **`supabase/009_equipment_maintenance.sql`** après les migrations existantes. Le script est idempotent et additif. Il crée la table `equipment_maintenance`, deux RPC et le bucket privé `equipment-maintenance`. Il ne modifie ni le document principal `workspace_state`, ni les contrôles, ni les échéances, ni les KPI. Tant qu'il n'est pas installé, les autres rubriques restent utilisables et le carnet signale son indisponibilité.

Une intervention comprend une date, une nature (réparation, entretien ou observation), un intervenant, un commentaire et une photo facultative. L'heure d'enregistrement et l'utilisateur sont conservés côté serveur. Les membres lecteurs peuvent consulter ; seuls les administrateurs et éditeurs peuvent ajouter une intervention. Aucune modification ou suppression directe n'est autorisée. Les répétitions d'une même requête ne créent pas de doublon.

Les photos JPEG/PNG/WebP de 12 Mo maximum sont préparées localement en JPEG (1600 pixels maximum, 2 Mo maximum), puis envoyées comme fichier binaire. Seul le chemin de stockage est enregistré en base. Un lien de consultation est signé pour 120 secondes lors du clic. Les restrictions Storage interdisent les accès hors espace, les modifications et les suppressions, même si une autre politique permissive existe. Aucun service tiers n'intervient. Un téléversement interrompu avant l'enregistrement peut laisser une photo non liée ; elle demeure inaccessible en lecture et peut être nettoyée par l'administrateur après vérification.

En mode local, le carnet et les photos sont conservés dans IndexedDB sur cet appareil, séparément des équipements. Ils ne sont pas inclus dans l'export JSON du parc. Le mode cloud utilise uniquement les tables et le stockage partagés.

Vérifications : `python tests/equipment_page_browser.py`, `python tests/maintenance_cloud_browser.py`, `node tests/maintenance_database.mjs` (serveur local sur le port 8000 pour les tests navigateur ; données fictives, aucun appel à la production).

## Nomenclature : types, variantes, repères et règles validées

La page Matériel propose **Standardiser les noms**. La même revue est accessible depuis Paramètres → Types et standardisation des noms → Standardisation automatique. Le catalogue, la standardisation par groupes et les fonctions de `nomenclature.mjs` restent communs : aucun deuxième catalogue n'est créé.

Le nom standard (`typeId`, `variantId`, `standardName`) est distinct du repère individuel facultatif `equipmentMark`, de la localisation et des propriétaires existants. Le numéro interne, l'ID VGP, le numéro de série et les liens vers les équipements ne changent pas. Les listes présentent le nom standard puis « repère — localisation ». La recherche inclut les noms d'origine, les noms et repères précédents dans l'historique et les noms source MemoryFlow. Une attribution non confirmée peut être signalée « Propriétaire à vérifier » ; aucun nom de salarié extrait d'un ancien nom n'est associé à un propriétaire.

La revue recharge le parc partagé avant analyse. La reconnaissance est entièrement locale : accents, casse, espaces, pluriels usuels, quelques abréviations explicites et détection de repères tels que AT-PR-01. Seuls les types du catalogue sont proposés. Plusieurs types, variantes ou repères possibles sont signalés comme ambigus. Les variantes sont proposées uniquement si une caractéristique technique du catalogue est explicitement reconnue. Les noms d'identifiants, de propriétaires ou d'emplacements connus sont refusés comme variantes. Un libellé inconnu reste à classer manuellement : aucun rapprochement approximatif n'est appliqué.

Le tableau est paginé par 50 fiches, comprend les archives et filtre par défaut les fiches non standardisées. On peut corriger le type, la variante, le repère et le signalement d'attribution, exclure des fiches, sélectionner les propositions fiables et valider la sélection. Une correction annule la validation de la ligne. L'application nécessite que toutes les lignes sélectionnées soient validées, puis une confirmation finale. Les règles exactes peuvent être mémorisées à cette étape. Les changements de périodicité, dates, statuts, résultats, contrôles ou propriétaires ne font pas partie de cette opération. Sur une fiche existante, changer simplement de type conserve également sa périodicité actuelle.

Les règles `namingRules` sont conservées dans le document partagé Supabase existant. Elles associent un ancien nom normalisé exact à un type et une variante, avec auteur, date et historique. Une règle peut être modifiée, désactivée ou réactivée ; aucun équipement n'est modifié par la seule sauvegarde d'une règle. Les imports Excel simples et MemoryFlow affichent les règles applicables dans leur prévisualisation. Une case explicite permet de les réutiliser, et la confirmation de l'import reste obligatoire. Les propositions sans règle validée ne sont pas appliquées par l'import. Les doublons existants restent ignorés, comme auparavant.

Chaque classification conserve `originalDesignation` et ajoute une entrée à `namingHistory` avec l'ancien nom, les identifiants du type et de la variante, le nom standard, le repère précédent et attribué, l'heure, l'utilisateur et l'origine du changement. Les contrôles et leurs informations figées, justificatifs APAVE, carnets de maintenance, échéances et calendriers restent indépendants. Les rapprochements APAVE acceptent aussi un repère exact ; plusieurs fiches avec ce même repère restent ambiguës.

**Aucune migration SQL supplémentaire** : ces champs facultatifs utilisent `workspace_state.payload` et la projection `equipment.details` existants. `read_state` / `write_state`, le contrôle de révision et les droits RLS actuels sont conservés. Un conflit entre deux postes bloque l'enregistrement ; « Analyser le parc » recharge les données avant une nouvelle revue. Aucun classement du parc réel n'est effectué pendant les tests ou le déploiement.

Vérifications ciblées : `node --test tests/naming_review.test.mjs`, `node tests/naming_review_database.mjs`, `python tests/naming_review_browser.py`, `python tests/naming_review_cloud_browser.py`. Les essais couvrent 850 fiches fictives, les ambiguïtés, la confirmation et son annulation, les règles réutilisées à l'import, les anciens noms recherchables, les attributions non inventées, les conflits concurrents, les droits Supabase et la conservation des contrôles, des périodicités et de la maintenance. Le tableau est aussi vérifié sur mobile.

Après une standardisation automatique confirmée (y compris une règle réutilisée à l’import Excel), le nom historique est aussi ajouté au commentaire de la fiche : « Ancien nom avant standardisation automatique du JJ/MM/AAAA : … ». Les commentaires existants restent intacts et précèdent cette note. Une revalidation ne répète pas une note déjà présente. L’historique de nomenclature reste conservé séparément ; aucun rattrapage automatique n’est exécuté sur les fiches déjà enregistrées.

Les recherches de la page Matériel proposent des menus recherchables « Type d’équipement » et « Variante technique », alimentés par le catalogue existant. La variante dépend du type et est remise à zéro lorsqu’on change de type. Ces filtres se combinent avec les échéances, les recherches textuelles et les affectations ; ils restent sélectionnés lors du passage entre Tout, Matériel, Archivés et les cartes de statut. La réinitialisation les efface. Les listes de contrôles réalisés et les détails mensuels disposent des mêmes filtres. Le rapprochement utilise les identifiants de classification enregistrés, sans déduire un type à partir d’un ancien nom. Ces actions de consultation n’écrivent aucune donnée.

Test : `python tests/material_naming_filters_browser.py` (menus recherchables, M16/M30, statuts, archives, noms libres, listes réalisées/mensuelles, retour à la fiche, mobile et absence d’écriture).

## Fenêtre d’import simplifiée

Paramètres → Import de rapports met uniquement APAVE au premier plan. Les imports Excel, les reprises de dates/statuts MemoryFlow et les migrations restent accessibles sous **Outils archivés**, replié à chaque ouverture. Aucun outil ni aucune donnée historique n'est supprimé. Le bouton APAVE du matériel reste disponible. Vérification : `python tests/import_tools_archive_browser.py`, plus les parcours APAVE et les anciens imports dépliés.

Les informations de dernière date déclarée dans MemoryFlow sont présentées comme une entrée distincte dans l’onglet Commentaires, avec l’auteur, la date de reprise, les dates déclarées et les détails source. Elles ne sont plus affichées dans l’onglet Contrôles. Cette présentation s’applique aussi aux fiches existantes, sans réécriture des données ni duplication dans le commentaire personnel. Le bandeau utilise par défaut le même logo Goodyear intégré que les rapports ; un logo personnalisé reste prioritaire.

Les paramètres de formulaire de connexion éventuellement présents dans l’adresse sont retirés au démarrage. Les formulaires de connexion/réinitialisation bloquent la soumission native tant que leurs gestionnaires JavaScript ne sont pas installés, afin de ne pas envoyer les champs dans une URL. Vérification : `python tests/memoryflow_comment_brand_browser.py` et `python tests/auth_browser.py`.


## Plans d’action de maintenance

Dans la fiche équipement → Carnet de maintenance, les réparations à faire sont séparées des interventions réalisées. Chaque action comporte un titre, un plan de travaux, une origine (Manuel ou APAVE), une référence de rapport facultative, un responsable facultatif, une priorité et une échéance facultative. Filtres par état et priorité, recherche textuelle ; priorité haute en premier, puis échéance. Les dates inconnues restent « À définir ». Aucun délai APAVE n’est inventé.

Exécuter **supabase/010_maintenance_actions.sql**, après 009, dans SQL Editor. Les tables sont indépendantes du parc et des contrôles. Lecture réservée aux membres du workspace, écriture aux administrateurs/éditeurs, révisions pour bloquer les modifications concurrentes et historique serveur des changements. La clôture exige une intervention de réparation (date, intervenant, travaux réalisés, photo facultative) enregistrée atomiquement avec l’action réalisée ; une nouvelle tentative de clôture identique ne crée pas de doublon. Les contrôles VGP, leurs KPI et les échéances restent inchangés. L’import automatique des actions APAVE et les KPI annuels attendent les futures règles métier. Les anciennes interventions et les photos privées sont conservées. Le mode local utilise une mise à niveau additive d’IndexedDB.

Vérifications : `node tests/maintenance_actions_database.mjs`, `python tests/maintenance_actions_browser.py`, `python tests/equipment_page_browser.py`, `python tests/maintenance_cloud_browser.py`. Tests sur données fictives uniquement.


### Numéros et niveaux des actions

Après 010, exécuter `supabase/011_maintenance_action_levels.sql`. Chaque action reçoit un numéro permanent `PA-…`, unique dans le parc (tous équipements confondus), attribué côté serveur. Les anciennes actions sont numérotées sans modifier leurs travaux ni leur échéance ; leur niveau reste « À classer » jusqu’à sélection explicite. Les nouveaux niveaux sont obligatoires et remplacent la priorité libre : **1 : immédiatement (date du constat)**, **2 : six mois calendaires après le constat**, **3 : 31 décembre de l’année de création de l’action, heure de Paris**. Les dates limites sont recalculées et vérifiées côté serveur. Pour six mois, une fin de mois est ramenée au dernier jour du mois cible si nécessaire. Les modifications ne changent ni le numéro ni l’année de création ; la recherche accepte `PA-56`, le tri et le filtre utilisent le niveau. La numérotation garantit l’unicité sans garantir une suite sans trous. Aucun contrôle VGP ni échéance d’équipement n’est modifié.

Vérifications : `node --test tests/maintenance_action_rules.test.mjs`, `node tests/maintenance_actions_database.mjs`, `python tests/maintenance_actions_browser.py`.

## Import Excel des actions APAVE

Bouton **Importer les actions APAVE (Excel)** dans Matériel, les paramètres d’import et le carnet de maintenance. Exécuter `supabase/012_apave_maintenance_import.sql` après 010 et 011. Le fichier `.xlsx` est lu localement, sans IA/service externe ni exécution de macros ; aucune donnée n’est écrite avant la confirmation de l’aperçu. La première feuille complète est utilisée (entête détectée même décalée), les autres vues par gravité sont ignorées. Limites : 20 Mo et 1 000 lignes avec gravité par import.

Règles : `numEquipement` rapproche exactement un numéro interne, numéro de série ou repère enregistré (y compris une composante séparée par `/`, `+`, `;` ou saut de ligne). Aucun rapprochement approximatif. « Sans plaque », les absences et les ambiguïtés demandent une association manuelle dans l’aperçu ; aucun équipement n’est créé. `gravite` doit être 1, 2 ou 3 ; sans gravité, la ligne est ignorée. `observation` devient le plan de travaux intégral, sans reformulation ni concaténation avec la colonne solution. `dateVisite` devient la date du constat : niveau 1 le jour du constat, niveau 2 six mois après, niveau 3 le 31 décembre de l’année de création de l’action. Les dates sont calculées côté serveur selon 011. Une ligne invalide est exclue ; l’utilisateur choisit les lignes importées et peut corriger une association. L’aperçu est paginé (30 lignes), et affiche les observations complètes, niveaux et dates limites.

Une action indépendante est créée par observation distincte ; plusieurs observations d’un même matériel restent plusieurs actions. Numéros `PA-…` attribués par le compteur existant. L’empreinte d’observation utilise le rapport, le numéro APAVE, la date de visite et le texte intégral, indépendamment du nom de fichier et de l’ordre des lignes. Les doublons sont écartés dans le fichier et en base. Un lot est atomique : une erreur annule tout le lot. Les imports simultanés sont sérialisés sur les empreintes. Une réponse réseau ambiguë peut être réessayée sans recréer d’actions ; une action déjà réalisée n’est pas réouverte par un réimport. La référence conserve le rapport, le fichier et la ligne ; la table d’origine conserve le numéro APAVE, la gravité, la date et le texte source. RLS conservée, membres lecteurs uniquement, écritures administrateurs/éditeurs par RPC. Aucun contrôle VGP, statut d’équipement, échéance VGP ou KPI n’est modifié.

Validation du fichier utilisateur EXTRACTION 2026.xlsx : première feuille « Extraction Leara », entête ligne 3, 219 observations avec gravité (34 niveau 1 / 97 niveau 2 / 88 niveau 3), 455 lignes sans gravité et 5 observations répétées. Sur un parc fictif contenant les identifiants du document : 209 actions automatiquement rapprochées, 5 autres à associer manuellement (identifiants non distinctifs). Les 209 observations ont été comparées intégralement après import local et un deuxième import n’a créé aucun doublon. Ce résultat ne mesure pas les correspondances avec le parc Supabase réel ; aucune donnée de production n’a été modifiée.

Tests : `node --test tests/apave_actions_import.test.mjs`, `node tests/apave_actions_database.mjs`, `python tests/apave_actions_browser.py`, `python tests/apave_actions_cloud_browser.py`. Pour retester le document fourni, sans le stocker dans Git : `node tools/analyze-apave-actions.mjs chemin/fichier.xlsx` et `APAVE_ACTIONS_FILE=chemin/fichier.xlsx python tests/apave_actions_reference_browser.py`.

## KPI plans d’action et reports justifiés

Dans le menu à trois barres, **KPI plans d’action** est une page distincte des KPI VGP. Exécuter `supabase/013_maintenance_kpi_deferrals.sql` après 012, puis actualiser le site. L’import Excel utilise désormais l’entrée RPC versionnée de 013 afin que le plafond annuel soit également appliqué aux actions APAVE importées.

**Consigne annuelle confirmée :** les échéances des niveaux 1, 2 et 3 sont limitées au 31 décembre de l’année de création. Niveau 1 : immédiat ; niveau 2 : six mois calendaires après le constat, plafonnés au 31 décembre ; niveau 3 : 31 décembre. La migration plafonne les anciennes actions ouvertes de niveau 1/2/3 sans report justifié. Leur date antérieure est conservée dans `initial_due_date` et `annual_cap_previous_due_date`, avec la date d’application de cette règle et une révision incrémentée. Elle ne change pas les actions déjà réalisées. Les dates VGP et les contrôles ne sont jamais modifiés.

Dans chaque action ouverte du carnet, **Reporter avec justification** exige une nouvelle date à venir, postérieure à l’échéance actuelle, et un motif non vide (budget, attente de pièce, etc.). La date initiale, toutes les dates successives, le motif, l’auteur déclaré, le compte authentifié et l’horodatage sont conservés. Le plan reste à faire/en cours. Une modification ordinaire conserve sa date reportée et ses justifications ; la date du constat et le niveau d’une action classée restent fixes. La clôture utilise toujours une intervention réellement enregistrée. Les reports utilisent la révision existante et un identifiant de demande pour permettre une nouvelle tentative après une réponse réseau ambiguë sans répéter l’historique. RLS et droits admin/editor sont maintenus ; les lecteurs peuvent consulter les KPI et l’historique mais pas reporter.

**Calculs affichés et périmètre :**
- Résolution globale des niveaux 1/2/3 et un taux pour chaque niveau, objectif 100 %. Le dénominateur inclut les plans créés dans l’année sélectionnée et le reliquat non résolu au début de cette année. Une résolution est établie par l’intervention liée, à sa date réelle. Les plans sans niveau restent visibles et sont signalés hors taux par niveau. Un report ne retire aucun plan du dénominateur et n’ajoute aucune résolution. Le pourcentage est arrondi vers le bas : 100 % exige une résolution complète.
- Plans non résolus, retards selon l’échéance applicable, reports justifiés, reliquat antérieur, reliquat à justifier (sans report couvrant l’année) et plans reportés au-delà du 31 décembre. Le numéro PA permet de suivre le même plan à travers les années.
- Interventions réalisées dans l’année : **toutes** les entrées du carnet (réparations, entretiens, observations), avec ou sans plan classé. Chaque entrée est comptée une seule fois, y compris lorsqu’elle clôture un plan. Le décompte utilise la date de l’intervention, pas la date de saisie. Ventilation par nature et histogramme sur les douze mois.
- Filtres par année et secteur, listes des plans à traiter et des justifications, accès direct au carnet. Les archives ne sont pas exclues. Les bilans historiques utilisent les dates de réalisation et l’historique des reports disponibles à la fin de l’année ; un report saisi l’année suivante ne masque pas les retards de l’année précédente. Les classifications et informations de localisation affichées sont celles des fiches actuelles.

Tests ciblés : `node --test tests/maintenance_action_rules.test.mjs tests/maintenance_kpi.test.mjs`, `node tests/maintenance_deferrals_database.mjs`, `node tests/maintenance_annual_upgrade.mjs`, `python tests/maintenance_kpi_browser.py`, `python tests/maintenance_kpi_cloud_browser.py`. Scénarios : plafond annuel et migration idempotente, motifs obligatoires, historique des reports, conflit de révision, reprise réseau sans doublon, dates initiales protégées, bilan historique, comptage sans double emploi, reliquat, secteurs, lecture RLS, mobile, parc/contrôles VGP intacts. Les parcours existants équipement, maintenance, import Excel APAVE et accueil ont également été vérifiés.

L’ancien scénario `tests/monthly.py` ne correspond plus au formulaire actuel : il tente de modifier directement un nom standardisé en lecture seule sans sélectionner « Nom libre », puis attend les anciens libellés « réalisé en retard ». Il échoue avant d’atteindre le KPI mensuel. Ces règles existaient déjà avant cette évolution ; ce scénario n’est pas déclaré validé. Aucun résultat de test ni contrôle historique n’est inventé pour les nouveaux KPI.


## Page Plans d’action et onglets du carnet

Le menu principal propose **Plans d’action**. Sa page regroupe deux onglets : **Suivi des plans d’action** (ouvert par défaut) et **KPI plans d’action**. La route existante `#actionKpi` est conservée. Les calculs et les droits du tableau de bord précédent sont inchangés ; aucun script SQL supplémentaire n’est nécessaire lorsque 013 est installé.

Le suivi reprend la présentation de Matériel : agenda de la semaine, navigation précédente/suivante et retour à cette semaine, compteurs cliquables, périmètres Tout / En cours / Réalisées, recherche par numéro PA/équipement/observation, filtres par état, niveau, secteur, zone, équipe, responsable, origine et échéance exacte, tris par échéance/PA/niveau/équipement/secteur/responsable avec ordre croissant ou décroissant. La liste est paginée par 30 plans. Les filtres et la semaine restent sélectionnés lors d’un aller-retour au carnet. Un bouton ouvre le plan précis ou son formulaire de réalisation.

Code couleur partagé entre agenda, compteurs, badges et lignes : rouge pour les retards, jaune pour les actions à faire, bleu pour les actions en cours de réalisation, violet pour les reports, vert pour les réalisées, gris pour les échéances non définies. L’état réalisé est prioritaire ; une action terminée n’est jamais présentée en retard. L’agenda conserve les plans réalisés à leur échéance et affiche leur date de réalisation. Il suit la recherche et les affectations, indépendamment du périmètre de la liste et de son filtre d’état. Les journées chargées montrent quatre cartes puis un bouton vers la liste complète de la journée, avec un décompte des réalisées. Aucun plan n’est supprimé du suivi.

Dans la fiche équipement → Carnet de maintenance, deux vrais onglets séparent **Actions en cours** et **Actions réalisées**, avec compteurs et navigation au clavier. L’onglet en cours contient uniquement les plans non terminés. Après l’enregistrement réussi de la réparation, le plan quitte cette liste et le carnet ouvre l’onglet réalisé. Une seule entrée y regroupe le numéro PA, la date, les travaux réalisés, l’intervenant et la photo ; le plan initial, la source et les reports restent consultables dans un détail dépliable. Les interventions sans plan classé restent également conservées dans les réalisées. Les formulaires non enregistrés restent protégés lors de la navigation.

Vérifications : `node --test tests/maintenance_tracking.test.mjs`, `python tests/maintenance_tracking_browser.py`, plus les scénarios équipement, maintenance/photos, KPI/reports, cloud simulé et import APAVE. Le test couvre une journée à 37 plans, la pagination, la réalisation ciblée, la conservation dans l’agenda et le retour aux filtres. Essais avec données fictives seulement ; le schéma, les contrôles VGP et les échéances d’équipement ne changent pas.

## Une seule action de maintenance, à faire ou déjà réalisée

Le carnet propose uniquement **Ajouter une action de maintenance**. Le même parcours demande **À faire** ou **Déjà réalisée** ; les champs adaptés apparaissent et le titre/texte sont repris lorsqu’on change ce choix. Il n’existe plus de bouton de création séparé pour une intervention et un plan d’action. Le mode à faire conserve les niveaux, échéances, états et reports existants. Le mode déjà réalisé accepte réparation/entretien/observation, un niveau facultatif, les travaux, l’intervenant, la date réelle et une photo facultative. L’intitulé est facultatif dans ce mode ; à défaut il reprend la première ligne des travaux. Les brouillons alternatifs sont conservés pendant le choix puis nettoyés après enregistrement ou annulation.

Exécuter **supabase/014_unified_maintenance_actions.sql** après 013. Une action saisie déjà réalisée reçoit aussi un numéro PA et une entrée liée dans le carnet, dans une transaction atomique. Une nouvelle tentative identique ne crée pas de doublon ; le même identifiant d’action est utilisé si le choix à faire/déjà faite a changé pendant la saisie, empêchant deux créations concurrentes de la même action. Une réalisation directe ne reçoit pas de fausse échéance prévue ; elle apparaît en vert dans l’agenda à sa date réelle si aucune échéance initiale n’existe. Elle figure dans le même répertoire global que les autres actions. Un niveau absent sur une action terminée n’est pas signalé comme une action en cours à classer. Les KPI d’activité comptent toujours l’entrée une seule fois.

La migration relie les anciennes entrées non associées à une fiche PA déjà réalisée, sans toucher au texte, à la date, à l’auteur ou à la photo d’origine. Leur niveau reste absent, leur date de création est reprise et aucun délai n’est inventé. Les anciennes actions déjà liées ne sont pas dupliquées. La reprise est idempotente et son équivalent local s’effectue dans IndexedDB. L’accès aux photos reste privé ; les rôles/RLS sont conservés. Aucun contrôle VGP ni aucune échéance d’équipement n’est modifié.

**Importer les actions APAVE (Excel)** est déplacé exclusivement dans **⚙ → Import de rapports**, avec une section dédiée à côté du PDF APAVE. Ce bouton ne figure plus dans le carnet, le matériel ou la liste des plans. Les anciens outils archivés restent accessibles et le parcours de prévisualisation/confirmation de l’Excel reste inchangé.

Vérifications : `node --test tests/maintenance_records.test.mjs`, `node tests/maintenance_unified_database.mjs`, `python tests/maintenance_unified_browser.py`, plus les parcours équipement, actions, photos/cloud, suivi/KPI, imports APAVE et outils archivés. Tests avec données fictives uniquement, dont les réponses réseau ambiguës, la conservation de la photo et le nombre d’actions/interventions sans doublons.
