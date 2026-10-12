# Métrologie — prototype

Application française sans dépendance ni installation nécessaire sur le PC.

## Essayer

Téléchargez `prototype-vgp.html` puis ouvrez-le avec Edge ou Chrome. Les deux équipements de départ sont fictifs. Ajoutez un équipement avec un identifiant unique, choisissez 3, 6, 9 ou 12 mois, et renseignez éventuellement le dernier contrôle avec son justificatif. Depuis sa fiche, ajoutez d’autres contrôles ou ouvrez un compte rendu, puis utilisez « Imprimer / enregistrer en PDF » et choisissez le PDF dans la fenêtre d’impression.

Les données et pièces jointes sont réellement conservées dans le stockage local du navigateur, pas sur un serveur. Exportez régulièrement une sauvegarde JSON, qui inclut les justificatifs. Un changement de navigateur, d’adresse ou de chemin de fichier, un effacement du stockage ou la navigation privée peuvent rendre les données indisponibles. Les sauvegardes peuvent contenir des données confidentielles : utilisez les emplacements autorisés par votre entreprise.

PDF/images limités à 1 Mo par pièce ; stockage total limité par le navigateur (souvent environ 5 Mo). Une erreur de stockage est signalée, sans annoncer un enregistrement réussi. Le prototype est destiné aux essais, pas à l’ensemble du parc réel.

Les notifications sont des alertes visuelles, sans e-mail, SMS ni tâche en arrière-plan. Les contrôles de niveaux 1 à 3, les comptes utilisateurs, le partage entre appareils et les sauvegardes automatiques ne sont pas implémentés. Aucun service externe ne reçoit les données.

## Échéances

Les délais sont des paramètres choisis par l’utilisateur, sans valeur réglementaire automatique. Calcul depuis le dernier contrôle par date, au même jour du mois ; si ce jour n’existe pas, utilisation du dernier jour. Le jour de l’échéance est « À venir », le lendemain « En retard ». Sans contrôle, l’échéance est « À définir » : cela ne signifie pas que le contrôle peut attendre. Une saisie historique plus ancienne ne repousse pas l’échéance. Modifier la périodicité recalcule l’échéance. L’anticipation est configurable de 0 à 365 jours.

Le résultat reste distinct de l’échéance. Un résultat « Introuvable » ou « À jeter » reste affiché ; le prototype ne décide pas d’une remise en service ou d’une conformité. Le compte rendu reprend les données déclarées ; localisation et affectation sont celles de la fiche actuelle.

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

## KPI

Le menu propose un onglet KPI, calculé sur tout le parc indépendamment des filtres. Contrôles réalisés = tous les enregistrements de l’historique ; actions réalisées = le même nombre, selon la définition actuelle d’une action. À faire = nombre d’équipements sans contrôle enregistré ou dont l’échéance est dépassée. Avancement = équipements actifs avec un contrôle enregistré et une échéance non dépassée / total des équipements actifs, arrondi à l’entier. Le jour de l’échéance est inclus. Sans équipement, le pourcentage est indéfini (—). Les contrôles à venir ne sont pas encore en retard. Les résultats n’influencent pas ce pourcentage : il ne mesure pas la conformité. Le décompte des contrôles réalisés peut dépasser le nombre d’équipements en raison de l’historique. Le prototype suit actuellement un type de contrôle par équipement, les réglementaires.

Tests : `node --test tests/domain.test.mjs tests/kpi.test.mjs` et, avec le serveur actif, `python tests/kpi.py`.

## Archivage, désarchivage et documents

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

Si aucun dernier contrôle n’est saisi, le nouvel équipement est enregistré avec une première échéance à la date locale d’ajout, statut À faire (puis En retard si cette date est dépassée). Il n’est ajouté aucun contrôle réalisé fictif, aucun résultat ni PDF de contrôle. Cette première échéance ne repousse pas le contrôle de 3/6/9/12 mois. Après un vrai contrôle, l’échéance se calcule à partir de sa date et de la périodicité choisie. Les équipements existants sans date restent inchangés.

Après une création réussie, l’application revient à la liste complète en retirant les filtres et confirme l’enregistrement. Si le stockage échoue, l’erreur est affichée dans le formulaire qui reste ouvert. Un double clic pendant l’enregistrement ne crée pas deux fiches. La création des identifiants techniques est compatible avec les contextes où crypto.randomUUID n’est pas disponible, grâce à crypto.getRandomValues.

Un premier contrôle non réalisé peut être à la fois sans historique et en retard ; ces catégories KPI se recoupent, mais un équipement compte une seule fois dans le nombre à faire. Le pourcentage continue d’exiger un véritable contrôle enregistré, pas une simple échéance.

Vérification : `python tests/creation.py` avec le serveur du port 8000 actif.

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
