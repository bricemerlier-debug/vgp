# Passer de votre prototype local à Supabase

La préparation est fournie, mais **aucun projet Supabase n'a été créé ni connecté**. `cloud-config.js` contient `enabled:false` : votre site continue à fonctionner comme auparavant. Aucun mail VGP n'est envoyé. Ne transmettez jamais un mot de passe, une clé `service_role`, une clé `sb_secret_…` ou une sauvegarde contenant vos données dans une conversation ou un dépôt public.

## 1. Ce que contient actuellement l'application

Le site est statique : `index.html`, `app.js`, `domain.mjs`, `style.css`, et la version autonome `prototype-vgp.html`. GitHub Pages distribue ces fichiers ; il n'exécute pas de serveur de base de données.

Les informations sont enregistrées sous la clé **`vgp-prototype-v1` de localStorage**, dans le navigateur utilisé. Un autre téléphone, navigateur, profil ou domaine a sa propre copie. Les modifications de code n'effacent pas cette clé. Les données fictives sont chargées uniquement en l'absence de sauvegarde. Dans un aperçu qui interdit le stockage, le mode mémoire est provisoire et avertit l'utilisateur.

| Information | Stockage actuel | Conservation dans la première phase cloud |
|---|---|---|
| Équipements, ID VGP, numéros uniques, nom, secteur/zone/équipe, localisation, propriétaire | `equipment[]` | Instantané complet + table `equipment` |
| Date de mise en service, périodicité, échéance manuelle, contrôle prévu | Champs de chaque équipement | Champs d'origine conservés dans `details` et l'instantané |
| Contrôles, date, résultat, vérificateur, observations, échéance d'origine, référence du rapport et informations figées | `equipment[].controls[]` | Instantané + table `controls`, historique protégé contre la suppression/modification |
| Justificatifs de contrôle et documents signés d'archivage | Fichiers encodés en base64 dans le JSON | Conservés intégralement dans les données protégées par RLS |
| Archivage, perte/rebut, demandes et approbations, commentaires | Champs de l'équipement | Conservés sans transformer une perte en contrôle |
| Propriétaires, contacts e-mail, vérificateurs et modèles de mail | `owners`, `ownerContacts`, `verifiers`, `mailTemplates` | Vues SQL sécurisées `owners`, `verifiers`, `mail_templates` sur l'instantané |
| Logo des rapports | JPEG base64 `reportLogo` | Conservé ; les PDF restent générés dans le navigateur |

**L'échéance et le résultat restent distincts.** La mise en service d'un équipement neuf n'est pas transformée en contrôle réalisé. Les règles de 3/6/9/12 mois restent celles du prototype et doivent être validées avec l'entreprise.

## 2. Architecture choisie pour une transition progressive

Le navigateur utilise Supabase Auth (e-mail/mot de passe), puis appelle trois fonctions SQL : `read_state`, `write_state`, `validate_migration`, via l'API HTTPS Supabase. Aucun SDK ou CDN externe n'est nécessaire au fonctionnement du site ; le lecteur Excel est livré dans `vendor/excel.js`.

`workspace_state` conserve le document complet compatible avec toutes les fonctionnalités. `write_state` reconstruit ses projections dans `equipment` et `controls`, **dans la même transaction**. En cas de doublon ou d'erreur, rien n'est enregistré. Les tables ne sont pas modifiables directement par le navigateur. `state_history` conserve les versions précédentes ; ce journal ne remplace pas une sauvegarde indépendante.

Chaque utilisateur doit être membre de l'espace de travail : `admin`, `editor` ou `reader`. Une simple inscription ne donne aucun accès. Les politiques RLS limitent les lectures aux membres ; les fonctions vérifient aussi les droits. Les visiteurs anonymes n'ont aucun accès aux données. Les vues utilisent `security_invoker` pour respecter RLS (PostgreSQL 15 ou supérieur).

Chaque enregistrement porte une révision. Si un autre appareil a enregistré entre-temps, l'enregistrement est refusé avec `REVISION_CONFLICT`. Notez vos modifications, puis utilisez **Actualiser** et ressaisissez-les. Le site charge les données à la connexion et au rechargement ; il n'utilise pas encore Supabase Realtime. Pas de sauvegarde hors ligne en mode cloud, ni de retour automatique vers la copie locale en cas de panne.

Cette phase convient à un prototype avec un nombre limité d'utilisateurs. Elle relit et enregistre l'ensemble du parc à chaque modification. Les pièces jointes sont dupliquées dans les projections et le journal : surveillez le volume. Limite serveur d'un instantané : 20 Mo ; le proxy du projet peut imposer une limite inférieure. Avant un grand déploiement, passer à des opérations SQL par fiche et déplacer les justificatifs dans un bucket **privé** Supabase Storage, avec des politiques par espace, des URL temporaires et une migration vérifiée. Aucun bucket public n'est créé ici.

## 3. Créer le projet : rien à installer sur le PC

1. Ouvrez [supabase.com](https://supabase.com/), créez votre compte puis un nouveau projet. Choisissez avec l'informatique la région d'hébergement, le forfait et la personne qui l'administre. Le mot de passe de la base reste dans un gestionnaire de mots de passe, jamais dans le code.
2. Dans **SQL Editor**, exécutez `supabase/001_schema.sql` sur ce **projet neuf**. Le script est transactionnel et prévu pour une première installation ; ne le réexécutez pas sur une base déjà utilisée. Les évolutions suivantes devront être des migrations SQL versionnées, sans suppression des tables existantes.
3. Dans **Authentication**, activez le fournisseur e-mail et désactivez les inscriptions publiques. Définissez la longueur minimale des mots de passe à 12 caractères. Dans URL Configuration, mettez l'adresse de votre site en Site URL et dans les URL de redirection autorisées, par exemple `https://bricemerlier-debug.github.io/vgp/`. Si vous utilisez le HTML autonome en ligne, autorisez aussi son adresse exacte. Autorisez une adresse localhost uniquement si vous voulez tester localement.
4. Dans **Authentication > Users**, invitez votre propre adresse. Copiez votre **User UID** affiché dans Supabase. Dans `supabase/002_workspace.sql`, remplacez `REMPLACER_PAR_UUID_UTILISATEUR` par cet UID puis exécutez le script. Il crée l'espace, votre appartenance administrateur, l'état vide et la configuration de rappels désactivée. Conservez l'ID d'espace renvoyé.
5. Vous pouvez inviter d'autres personnes puis ajouter leur appartenance avec l'exemple SQL commenté du même fichier. Le rôle `reader` permet la consultation ; `editor` permet les ajouts/modifications ; seul `admin` migre et valide la sauvegarde initiale. Les boutons d'édition peuvent rester visibles pour un lecteur, mais le serveur refuse tout enregistrement.
6. Dans les paramètres du projet, récupérez l'URL du projet et sa clé **publishable** (`sb_publishable_…`) ou l'ancienne clé **anon**. Ces clés sont publiques : la protection vient de RLS et de l'authentification. **N'utilisez jamais la clé secret/service_role**, même temporairement.

L'e-mail d'invitation permet de définir votre mot de passe sur le site une fois la connexion configurée. Si le lien a expiré, utilisez « Mot de passe oublié » ou renvoyez une invitation. Les e-mails d'authentification Supabase sont différents des rappels VGP. Pour les invitations et réinitialisations en usage réel, l'informatique devra configurer le SMTP et vérifier les quotas d'Auth.

## 4. Renseigner le site

Avant toute activation, faites les exports décrits dans la section suivante.

Modifiez **uniquement les valeurs publiques** dans `cloud-config.js` :

```js
window.VGP_CLOUD = Object.freeze({
  enabled: true,
  url: 'https://VOTRE_REFERENCE.supabase.co',
  publicKey: 'VOTRE_CLE_PUBLISHABLE',
  workspaceId: 'UUID_DE_VOTRE_ESPACE'
});
if(window.VGP_CLOUD.enabled)document.documentElement.classList.add('cloud-locked');
```

Les textes ci-dessus sont des emplacements à remplacer, pas des identifiants utilisables. Le code refuse les clés secrètes et les JWT `service_role`. Cette vérification ne peut pas annuler l'exposition d'une clé que quelqu'un aurait déjà publiée : en pareil cas, révoquez-la dans Supabase et traitez l'historique Git avec l'informatique.

Pour GitHub Pages, publiez `cloud-config.js`, `cloud.mjs`, `excel.mjs`, `vendor/excel.js` **avec** `app.js`, `index.html`, `domain.mjs`, `style.css`. Tous sont fournis dans le dépôt. Le verrou de connexion apparaît avant l'affichage des équipements. Ne retirez pas les scripts nouveaux. La version autonome générée incorpore sa propre copie de la configuration : si vous l'utilisez, régénérez-la après la configuration, sinon elle reste en mode local.

Pour le développement, Node/npm servent uniquement à régénérer le lecteur Excel et à tester PostgreSQL localement. Cela installe des dépendances dans le dossier du projet ; ce n'est pas nécessaire pour consulter le site. Aucune installation automatique n'est effectuée sur votre PC. Dans l'environnement de développement :

```sh
npm ci --cache /tmp/vgp-npm-cache
node tools/check_config.mjs
npm run build
npm run test:cloud
python tools/dev_server.py
```

Sur Windows, `start-local.bat` utilise Python 3 s'il est installé : il ouvre un serveur limité au PC, avec rechargement automatique. Adresse à saisir : `http://localhost:8001`. Si Python n'est pas installé, demandez à l'informatique avant installation. Pour Supabase, utilisez de préférence votre lien HTTPS GitHub Pages. Le HTML autonome reste utilisable hors ligne **en mode local** ; les liens d'invitation/réinitialisation exigent une adresse web autorisée.

## 5. Migrer sans perdre les données

1. **Avant d'activer le cloud**, sur chaque navigateur/profil contenant des données, cliquez sur **Exporter une sauvegarde**. Gardez les fichiers JSON sur un emplacement d'entreprise sauvegardé. Ne les ajoutez pas à GitHub. Exportez aussi depuis le fichier HTML local si vous y avez travaillé : son stockage est distinct de GitHub Pages.
2. Définissez quelle copie est la référence. Si PC et téléphone contiennent déjà des informations différentes, ne remplacez pas une copie par l'autre : réunissez et vérifiez les sauvegardes avant de migrer. La migration initiale n'effectue pas de fusion automatique entre sauvegardes.
3. Testez d'abord sur un projet Supabase de test et une copie du site. Connectez-vous comme administrateur. Ouvrez **⚙ > Données et import Excel**. N'ajoutez pas un équipement dans cet espace avant la migration : la migration demande un espace vierge (révision 0).
4. Choisissez **Importer la sauvegarde locale** si les anciennes données sont sur la même adresse et dans le même navigateur. Sinon choisissez le **fichier JSON exporté**. La sauvegarde est validée et un récapitulatif des équipements/contrôles apparaît avant confirmation. Les champs anciens manquants sont complétés selon la logique existante ; les dates et résultats ne sont pas réinventés.
5. L'import s'effectue en transaction ; l'application relit ensuite **tout le JSON** et compare toutes les valeurs, y compris documents et historiques. `migration_receipts` trace l'import. Tant qu'il n'est pas validé, le serveur bloque les modifications. Si la connexion est interrompue après l'import, reconnectez-vous : le bouton de validation est retrouvé. Si un contrôle de relecture échoue, ne validez pas ; gardez la source et demandez un diagnostic.
6. Vérifiez plusieurs fiches : équipements actifs et archivés, ID VGP, numéros, propriétaires/e-mails, échéances manuelles et automatiques, commentaires, contrôles, rapports PDF, justificatifs et approbations signées. Vérifiez les compteurs et les indicateurs mensuels. Exportez le cloud et comparez avec votre source (les compléments de format anciens sont normaux).
7. Ouvrez le même lien depuis un second navigateur ou votre téléphone, connectez-vous au même espace et vérifiez les mêmes fiches. Testez une création et un contrôle **après validation**, puis leur présence sur l'autre appareil via Actualiser. Déconnectez-vous et vérifiez qu'aucune liste n'est visible ; testez également un compte invité sans appartenance et un lecteur.
8. Cliquez sur **Valider la migration après mes vérifications**. La validation contrôle à nouveau l'instantané côté serveur et est datée. Répétez ce parcours pour la base définitive, puis cessez les saisies dans les anciennes copies locales.

**Le code n'efface jamais `vgp-prototype-v1` lors de la migration ni des enregistrements cloud.** Il ne synchronise pas automatiquement cette copie : après le passage au cloud, elle représente l'état ancien. Si vous repassez `enabled:false`, vous retrouverez cette ancienne copie locale, pas les dernières modifications cloud. Exportez d'abord le cloud ; un retour contrôlé peut ensuite importer cet export en mode local. Ne basculez pas silencieusement en mode local pendant une panne.

Le remplacement intégral via « Importer une sauvegarde » de la liste matériel est bloqué en mode cloud. Une restauration de production demande une procédure d'administration avec sauvegarde, arrêt temporaire des écritures et validation, pas une suppression des protections SQL.

## 6. Importer un fichier Excel

Ouvrez **⚙ > Données et import Excel**. Le site lit la **première feuille d'un `.xlsx`**, localement dans le navigateur. Les `.xls`, `.xlsm` et fichiers CSV ne sont pas pris en charge ici. Limites : 5 Mo compressés et 5 000 lignes de données ; utilisez des fichiers exportés fiables et petits.

Exemple d'en-tête :

```text
Numéro interne | Nom | Numéro de série | Secteur | Zone | Équipe | Propriétaire | Email | Localisation | Périodicité mois | Dernier contrôle | Vérificateur | Résultat | Prochain contrôle | Commentaire
```

Seuls **Numéro interne** et **Nom** sont obligatoires. Une périodicité absente prend 12 mois, choix du prototype à valider. Secteurs : A1/A2/B1/B2/B3 ; zones : DMCR/Yuzer en B2 ; équipes : A/B/C/D/E/Jour. Les accents, espaces et majuscules des en-têtes sont tolérés ; les colonnes non reconnues sont ignorées. Mettez les numéros dans des cellules **texte** pour conserver les zéros au début ; évitez les formules et les nombres convertis en notation scientifique.

Dates : cellule date Excel, ou texte **AAAA-MM-JJ**. Aucun déchiffrement de dates ambiguës comme 01/02/26. Un dernier contrôle exige sa date, son vérificateur et l'un des quatre résultats exacts de l'application. Un équipement sans dernier contrôle reste sans contrôle réalisé ; son échéance est calculée selon la logique actuelle, sauf date manuelle. L'import Excel n'invente pas de justificatif et n'importe pas des pièces jointes ni plusieurs contrôles par équipement : pour la migration complète de l'historique et des PDF, utilisez **JSON**.

L'analyse affiche les lignes prêtes, les doublons et les erreurs. Les numéros internes et numéros de série sont comparés sans tenir compte de la casse ni des espaces au bord, dans le fichier **et** dans le parc existant, archives comprises. Les doublons sont ignorés ; aucune mise à jour d'une fiche existante n'est effectuée. Corrigez toutes les lignes en erreur avant d'ajouter. Le bouton ajoute l'ensemble des lignes prêtes avec un seul enregistrement ; un conflit ou une erreur annule l'ensemble. Les contraintes SQL constituent une deuxième protection.

## 7. Rappels automatiques : architecture prête, envois désactivés

Les modèles personnalisés et les contacts restent utilisables. Les notifications de la cloche sont des alertes internes calculées dans le navigateur ; elles ne prouvent pas l'envoi d'un mail.

Le script crée `reminder_settings`, `reminder_jobs`, `reminder_attempts`. `enabled` est fixé à `false` par une contrainte : impossible d'activer accidentellement les envois. Aucun cron, aucune Edge Function et aucun accès Microsoft 365 n'est installé. `reminder-plan.mjs` décrit et teste le calcul **J-30, J-14, J-7, J0 en jours calendaires**. Le tableau actuel « À faire » reste à un mois calendaire ; il peut différer de J-30 et ne constitue pas le plan du serveur.

La phase suivante devra installer un worker serveur (par exemple Supabase Edge Function déclenchée quotidiennement) :

- Lire les échéances et contacts dans le fuseau `Europe/Paris`, ignorer les archives, refuser les destinataires absents et créer les quatre rappels. La contrainte unique `(workspace_id,equipment_id,due_on,stage)` évite les doublons de planification.
- Après un nouveau contrôle ou une modification d'échéance/propriétaire, annuler les jobs périmés et recalculer ceux à venir ; vérifier l'état juste avant chaque envoi. Définir avec vous le rattrapage des rappels déjà dépassés.
- Réserver les jobs avec verrou et délai de réservation pour plusieurs workers, tracer les tentatives, limiter les retries et traiter le cas où Microsoft a reçu un mail mais où l'accusé de réception s'est perdu. La contrainte SQL ne garantit pas à elle seule un envoi exactement une fois.
- Remplacer les variables des modèles avec les informations réelles. Utiliser Microsoft Graph et une boîte d'entreprise autorisée, avec droits validés par l'informatique. Conserver les secrets Microsoft et toute clé serveur Supabase **dans les secrets du serveur uniquement**. Restreindre l'accès administratif aux journaux.
- Ajouter une migration SQL explicite pour autoriser l'activation, puis tester les envois avec une boîte de test avant de planifier le traitement réel.

Le vérificateur sélectionné dans un rapport reste un champ de la fiche ; Auth identifie l'utilisateur connecté pour le journal d'enregistrement. Ce n'est pas une signature électronique du vérificateur. Les conclusions des rapports et la consigne J0 doivent être validées par l'entreprise.

## 8. Mises à jour, sauvegardes et validations

Une mise à jour GitHub Pages remplace le code ; les données cloud restent dans PostgreSQL. Ne recréez jamais l'espace à chaque déploiement, ne modifiez pas les identifiants d'espace et ne réexécutez pas les scripts d'installation. Gardez `cloud-config.js` cohérent et régénérez la version autonome si vous l'utilisez. Une future modification de schéma devra être compatible avec les appareils encore ouverts sur une ancienne version.

Avec l'informatique : organiser les accès administrateur, MFA et départs d'utilisateurs, les sauvegardes indépendantes, la rétention du journal, la restauration testée, les coûts/quotas et l'hébergement. Vérifier les sauvegardes/PITR réellement inclus dans le forfait Supabase ; ne pas les supposer incluses. GitHub sauvegarde le **code**, pas la base. Les exports JSON contiennent des données d'entreprise et doivent rester hors du dépôt.

Validation fournie : tests PostgreSQL réels via PGlite (RLS, rôles, doublons, transactions, conflits, migration et conservation des justificatifs), tests du client et import XLSX dans Chromium avec une API simulée et deux contextes indépendants, et tests existants des fonctionnalités locales. **Le service Supabase réel, les invitations, l'envoi d'e-mails d'Auth, les quotas et Microsoft 365 restent à tester après création du projet.** Aucun test simulé n'est présenté comme une validation de production.

Références : [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [clés API](https://supabase.com/docs/guides/api/api-keys), [Auth](https://supabase.com/docs/guides/auth), [Storage privé](https://supabase.com/docs/guides/storage/security/access-control).
