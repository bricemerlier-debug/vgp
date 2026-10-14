> Si l’enregistrement affiche « statement timeout », appliquer [le correctif 004](CORRECTIF-DELAI-SUPABASE.md) dans Supabase, puis relancer la reprise.

# Activation sur le site réel

Le propriétaire de l'application a autorisé la publication de l'étape 1. Le site conserve sa configuration Supabase et ses données. Le fichier Excel transmis n'est pas ajouté au dépôt et n'est pas importé automatiquement dans la base de production.

## Une seule manipulation dans Supabase

Je ne dispose pas d'un accès administrateur au projet Supabase. Le site publié affiche donc « Lecture seule temporaire » tant que sa nouvelle protection serveur n'a pas été installée. Les données restent consultables et exportables ; les tentatives d'ajout ou de modification sont refusées avant toute écriture.

1. Fermer les anciens onglets du site sur PC et téléphone, puis ouvrir [le site](https://bricemerlier-debug.github.io/vgp/) et se connecter.
2. Exporter la sauvegarde JSON actuelle depuis Matériel et la conserver dans un emplacement autorisé par l'entreprise. Cette sauvegarde inclut les équipements, contrôles, commentaires et documents.
3. Ouvrir le projet concerné dans [Supabase](https://supabase.com/dashboard), puis **SQL Editor > New query**.
4. Copier **tout** le contenu de [supabase/003_tracking_guard.sql](../supabase/003_tracking_guard.sql), le coller dans cette nouvelle requête et cliquer **Run**. Ne pas relancer `001_schema.sql` ou `002_workspace.sql` : ils servent à l'installation initiale déjà effectuée. Ne partager aucune clé secrète ou mot de passe.
5. Si Supabase affiche une erreur, conserver son message et ne pas exécuter de commande de suppression. Le script est transactionnel : un échec annule son installation.
6. Revenir sur le site et faire **Ctrl+F5**. La bannière disparaît lorsque le site confirme que la protection est active. Si nécessaire, patienter quelques secondes le temps que Supabase actualise son API.

Le script ajoute un contrôle de conservation de l'historique et une fonction de vérification accessible uniquement aux utilisateurs authentifiés membres de l'espace. Il ne supprime ni équipement ni contrôle, ne valide aucune ancienne échéance et n'envoie aucun mail. Il peut être réexécuté pour réinstaller cette protection. L'activation réelle reste à effectuer par l'administrateur ; les tests du script ont utilisé une base PostgreSQL isolée.

## Importer l'export Excel fourni

1. Ouvrir **⚙ > Données**, puis **Ajouter depuis Excel**.
2. Sélectionner `export-complet.xlsx` dans le sélecteur de fichier.
3. Lire l'aperçu : les 4 608 lignes source sont regroupées en 700 ID d'équipement. Dans ce fichier, avant comparaison avec vos données actuelles, 657 fiches sont importables et 43 nécessitent une correction. Les doublons avec le site peuvent encore réduire le nombre d'ajouts.
4. Corriger les erreurs dans une copie du fichier, ou cocher **Importer uniquement les fiches valides** pour laisser explicitement les erreurs de côté.
5. Cliquer **Ajouter les lignes valides**, vérifier le récapitulatif puis confirmer. Les fiches existantes ne sont jamais écrasées. Réimporter le même fichier ne crée pas de doublons.

L'export utilise « N° interne » et « N° de série », désormais reconnus. Son **ID source** est conservé séparément de l'ID créé par le site. Ses lignes mélangent les suivis réglementaires et d'autres niveaux : elles sont regroupées, les autres niveaux restant conservés dans les informations source de la fiche. La fréquence réglementaire est proposée comme information à valider ; les niveaux 1, 3 et 4 ne créent pas des VGP supplémentaires.

Les 43 fiches bloquées se répartissent ainsi : 23 sans numéro interne, 18 avec numéro interne ou série partagé entre plusieurs ID, 1 sans ligne réglementaire et 1 avec fréquence réglementaire non prise en charge. Aucun numéro n'est inventé et aucune fusion n'est faite automatiquement.

Votre export contient des dates et des informations anciennes, mais aucun vérificateur renseigné ni résultat global exploitable. Elles sont conservées dans **Informations conservées de l'import Excel**, avec les grilles et observations présentes. Aucun contrôle réalisé ni PDF officiel n'est inventé. Les nouvelles fiches restent **Situation à vérifier** jusqu'à validation de leurs échéances et règles de suivi, ou enregistrement d'un vrai contrôle. Le champ Service est repris comme localisation provisoire ; responsables et localisations restent à vérifier.

Pour importer ensuite les contrôles réellement effectués, il faudra leurs dates, résultats et vérificateurs, avec justificatifs lorsque disponibles. Cette version conserve l'export original dans les données de chaque fiche mais ne remplace pas ces éléments manquants.

## Après activation

Vérifier vos fiches, leurs documents et le changement des indicateurs. Les anciennes dates restent présentes, mais une date historique n'est pas déclarée validée à votre place. La migration des anciens « Introuvable » reste une action explicite dans **⚙ > Données**, après sauvegarde et vérification du diagnostic.

La case **Rester connecté** est disponible sur la page de connexion. Aucun mot de passe n'est sauvegardé. Les rappels restent des aperçus : aucun envoi automatique réel n'est activé.
