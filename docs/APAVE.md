# Import des rapports APAVE — première version

Le bouton **Importer un rapport APAVE** est disponible dans Matériel et dans Paramètres → Données. Le lecteur reconnaît la structure textuelle APAVE Leara : fiches individuelles et lots contenant plusieurs accessoires par page. Il traite le PDF original, sans découpage, image ou capture. PDF.js et son worker sont livrés avec le site ; le texte n'est envoyé à aucune IA ou API d'analyse.

## Activation Supabase

L'aperçu fonctionne sans migration. Pour enregistrer en mode partagé, exécuter une fois [006_apave.sql](../supabase/006_apave.sql) dans le SQL Editor du projet, après les scripts 001, 003 et 004. Ce script crée un bucket **privé** `apave-reports`, deux tables, les politiques RLS et une procédure d'import. Il n'importe aucun contrôle et ne modifie aucune fiche existante. L'application vérifie son activation avant d'envoyer un PDF.

Les lecteurs autorisés peuvent consulter ; seuls les éditeurs et administrateurs peuvent importer. Les autres espaces et utilisateurs anonymes sont exclus. Les fichiers ne peuvent pas être remplacés ou supprimés par les clients de l'application, même en présence d'une autre politique Storage permissive. Les protections métier existantes restent actives. Aucune clé secrète n'est utilisée dans le navigateur.

## Utilisation

1. Choisir le PDF original. L'analyse, page par page, affiche sa progression. Limites de cette version : 100 Mo, 1 200 pages ; la limite globale Storage du projet peut être inférieure.
2. Consulter l'aperçu paginé, rechercher un équipement et ouvrir le PDF à la page indiquée. Les dates viennent de **Date de la vérification**, jamais de la date d'édition du rapport. Pour un accessoire non vérifié, la date du lot reste une date de contexte, et aucune date de contrôle effectué n'est créée.
3. Les correspondances ne sont proposées que sur une égalité exacte du numéro interne ou du numéro de série, après suppression des espaces aux extrémités et comparaison sans distinction majuscules/minuscules. Un suffixe différent reste un autre identifiant. Les correspondances contradictoires, identifiants répétés ou absents imposent un choix manuel. Aucun rapprochement approximatif et aucune nouvelle fiche automatique.
4. Cocher les lignes à importer et corriger leur fiche si besoin. Le choix initial **Conserver le constat APAVE** enregistre le résultat source dans la fiche sans changer les statistiques. Pour une vérification complète et exploitable, choisir explicitement le résultat métier voulu. Une observation n'est jamais automatiquement traduite en « Bon état » ou « Mauvais état ».
5. Confirmer la vérification des associations, puis cliquer sur Valider et accepter le récapitulatif. Avant cette étape, aucune écriture d'import n'a lieu, y compris dans Storage.
6. Les contrôles réalisés apparaissent dans l'historique habituel ; les constats partiels/non vérifiés ou sans résultat métier attribué apparaissent dans une section distincte de la fiche. Chacun propose **Voir le rapport APAVE** et sa plage de pages.

**Les non-vérifiés, partiels, incomplets et matériels hors suivi ne peuvent pas valider une VGP complète.** L'import ne met pas automatiquement au rebut un matériel et ne déclare pas un matériel perdu. Une vérification complète validée est ajoutée aux contrôles existants et utilise leur calcul de prochaine échéance. L'ancien planning n'est pas reconstruit : aucune date prévue passée n'est inventée pour gonfler les KPI mensuels.

## Stockage et doublons

L'empreinte SHA-256 est calculée localement sur les octets du PDF. Le chemin est `ESPACE/EMPREINTE.pdf` : un seul original par espace et empreinte. Le contenu binaire va exclusivement dans Storage. Les fiches contiennent le texte extrait et une référence, jamais le PDF en base64.

Le numéro de rapport est unique par espace ; un même numéro avec un fichier différent est refusé. Chaque couple rapport/numéro d'ordre/accessoire est unique. Les contrôles réalisés sont également protégés contre la réimportation pour le même équipement et le même rapport. Un contrôle du même vérificateur déjà enregistré à la même date bloque un nouvel import réalisé. Les lignes déjà importées sont marquées et ignorées dans l'aperçu. On peut reprendre le même original pour associer les lignes précédemment laissées de côté.

Les associations, l'historique métier et le reçu d'import sont enregistrés dans **une transaction**, avec contrôle de révision. Un conflit ou une erreur annule cette transaction. Un PDF déjà envoyé peut rester dans le bucket privé après un échec de transaction : la reprise réutilise le même chemin sans écrasement. Ne pas effacer ce fichier pour tenter de corriger une erreur d'import. En cas de coupure réseau, actualiser puis réanalyser ; les contraintes serveur empêchent les doublons.

Au clic sur le rapport, la session authentifiée demande une URL signée valable **120 secondes**, puis ajoute `#page=N`. Cette URL n'est jamais conservée en base. Toute personne possédant cette URL peut l'utiliser pendant ces 120 secondes : il ne faut pas la partager. La page initiale dépend de la prise en charge de `#page` par le lecteur PDF ; la plage reste toujours visible dans la fiche. L'expiration du lien ne retire pas un document déjà ouvert ou téléchargé.

## Limites de reconnaissance

Cette version est adaptée au modèle **Leara textuel** fourni. Un PDF scanné sans texte, chiffré sans mot de passe, ou une structure non reconnue est refusé ; aucune lecture OCR ni interprétation externe automatique n'est faite. Les formulations de non-vérification et de vérification partielle reconnues sont signalées de manière prudente. Le PDF original et la validation humaine restent la référence pour les autres formulations, tableaux complexes ou variantes APAVE. Les mots ne sont ni corrigés ni reformulés ; les retours à la ligne sont ceux du texte extrait.

En mode local, les constats peuvent être testés sur des données fictives, mais le fichier original reste seulement en mémoire jusqu'à fermeture/rechargement. Pour un usage durable et partagé, activer Supabase. Le HTML autonome doit être servi avec le dossier `vendor/pdfjs` ; la lecture APAVE n'est pas intégralement embarquée dans le fichier HTML seul.

## Validation reproductible sans production

```sh
npm ci
npm run build
node tests/apave.test.mjs
node tests/apave_cloud.mjs
node tests/apave_database.mjs
node tests/apave_volume.mjs
python tests/apave_browser.py
python tests/apave_cloud_browser.py
```

Le test de volume vérifie une transaction de 561 constats sur 864 fiches fictives. Le test PostgreSQL utilise PGlite avec un schéma Storage fictif et vérifie l'atomicité, les droits, le bucket privé, les doublons et les historiques immuables. Le test navigateur nécessite le site servi sur `127.0.0.1:8000` et Chromium. Il contrôle l'absence d'écriture avant confirmation et l'absence de requête vers un service externe.

Pour vérifier un rapport réel sans le publier dans le dépôt :

```sh
node tests/apave_reference.mjs /chemin/prive/rapport.pdf /chemin/prive/attentes.json /tmp/preuve.json
python tests/apave_reference_browser.py /chemin/prive/rapport.pdf /chemin/prive/attentes.json
```

Les attentes privées contiennent `reportNumber`, `pageCount`, `totalEntries` et `equipment` (les fiches extraites de référence dont les dates, pages et observations ont été vérifiées dans l'original). Les deux lecteurs doivent retrouver exactement ces fiches. Ni le PDF réel, ni les observations métier réelles, ni les relevés d'extraction ne doivent être ajoutés à ce dépôt public.

La migration est testée localement. L'activation Storage et les essais d'enregistrement dans le projet Supabase déployé restent à effectuer après installation du script ; les essais sur le rapport réel ne modifient pas Supabase.
