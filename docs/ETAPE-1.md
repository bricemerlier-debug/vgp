# Étape 1 — version à vérifier, sans publication en production

Cette version corrige les KPI, les déclarations de matériel introuvable et les échéances. Elle conserve le projet actuel et sa connexion Supabase. Aucun équipement réel, compte réel ou projet Supabase n'a servi aux tests. Aucun mail n'est envoyé.

## Essayer sans toucher aux données de l'entreprise

1. Télécharger et extraire le ZIP de la branche de vérification.
2. Ouvrir une fenêtre de navigation privée dans Edge ou Chrome.
3. Ouvrir **prototype-vgp.html** depuis le dossier extrait. Ce fichier est autonome, avec Supabase désactivé pour ces essais. Aucune installation n'est nécessaire. **Ne pas ouvrir index.html pour cet essai** : il utilise la configuration centralisée actuelle.
4. Dans Matériel, importer la sauvegarde **docs/examples/vgp-etape-1-fictif.json** avec « Importer une sauvegarde ». La confirmation remplace uniquement les exemples de cette fenêtre privée.
5. Consulter Accueil et KPI, ouvrir les listes puis les fiches. Au 13 octobre 2026, l'exemple affiche 50 % d'échéances à jour et 33 % de contrôles réalisés à temps pour octobre : un réalisé à temps, un tardif, un échu non réalisé. Une autre fiche est à vérifier. Ces dates sont fixes : les chiffres évoluent avec le jour de consultation.
6. Créer une fiche sans contrôle ni justificatif d'échéance : elle doit afficher « Situation à vérifier ». Cliquer sur ce libellé pour saisir une première échéance justifiée.
7. Déclarer un équipement introuvable, avec auteur et commentaire de recherche : il doit être archivé sans ajout de VGP réalisée. Le réactiver : il revient « Situation à vérifier », avec son historique intact.

Le stockage de cet essai est réellement local et reste présent après un rafraîchissement dans la même fenêtre. La fermeture des fenêtres privées efface les données de test. Pour conserver un essai, exporter sa sauvegarde JSON avant de fermer. Ne pas importer de données professionnelles dans cet exemple.

## Ce que le code existant faisait

L'application utilise une sauvegarde JSON : équipements, contrôles, propriétaires, commentaires, justificatifs encodés et paramètres. Le mode local emploie `localStorage`, clé `vgp-prototype-v1`. Le mode centralisé emploie Supabase Auth et un document d'espace de travail protégé par RLS, avec révision pour éviter les écrasements concurrents. Les données locales restent disponibles pour la migration.

Les anciens indicateurs comptaient un contrôle ancien comme couverture du parc et comptaient aussi « Introuvable » parmi les réalisations. La première échéance pouvait provenir de la date de création informatique. Les graphiques mensuels dépendaient du parc actuellement actif. Ces comportements sont corrigés ; les enregistrements d'origine sont conservés.

## Calculs de cette version

| Indicateur | Calcul / portée |
|---|---|
| VGP à jour | Équipements actifs avec une échéance validée non dépassée / tous les équipements actifs suivis, situations inconnues comprises. |
| Dans les délais, par mois | Échéances de ce mois satisfaites par un contrôle daté au plus tard à leur date limite / toutes les échéances enregistrées de ce mois. |
| Réalisés en retard | Échéances satisfaites après leur date limite ; restent rattachées au mois de l'échéance. |
| Échus non réalisés | Échéances passées sans réalisation ni exclusion antérieure à leur échéance. Une perte déclarée après le dépassement ne gomme pas ce retard historique. |
| Situation à vérifier | Équipement actif sans échéance exploitable et validée, ou retrouvé nécessitant une nouvelle vérification. |
| Anomalies | Équipements actifs dont le dernier résultat exploitable est « réparable » ou « à jeter ». Indicateur provisoire, sans suivi de réparation clôturable à ce stade. |
| Introuvables archivés | Matériels archivés avec motif « Équipement perdu », séparés du parc actif et des réalisations. |

Les pourcentages sont arrondis à l'entier. Sans dénominateur, affichage « Non applicable ». Une échéance à jour ne certifie **pas** la conformité, l'absence d'anomalie ou une autorisation d'utilisation. Une première échéance explicitement justifiée peut compter comme à jour sans ajouter de contrôle réalisé.

Un contrôle exploitable comporte une date, un vérificateur déclaré et un résultat parmi bon état, réparable ou à jeter. « Introuvable » est un événement, jamais une VGP. Le premier contrôle exploitable associé à une échéance la satisfait une seule fois : des contrôles supplémentaires ne compensent pas le matériel non contrôlé. Les anciens contrôles sans échéance associée restent visibles mais ne reçoivent pas de date inventée pour le graphique mensuel ; leur nombre est signalé.

Les échéances sont désormais conservées dans un registre par équipement, avec réalisation et exclusions. Un archivage ne retire pas les échéances historiques de ce registre. Les exclusions sont visibles à côté des résultats. Les informations existantes, notamment commentaires et pièces jointes, restent conservées.

## Dates et décisions métier à confirmer

La version de vérification propose ces règles ; elles restent à valider avec l'entreprise avant publication :

- Validation de la périodicité **par fiche**, avec auteur et justification. Le champ famille prépare une future gestion des règles par famille. Les choix 3/6/9/12 mois ne valent aucune règle réglementaire.
- Première échéance sans contrôle : saisie explicite avec origine, justification, auteur et confirmation. Aucune échéance calculée depuis la création de la fiche. Les anciennes dates sont conservées comme informations à valider, sans leur attribuer une validation rétroactive.
- Cohorte mensuelle initiale conservée : les sorties de parc restent dans le dénominateur et leurs exclusions sont affichées séparément. Cette convention privilégie la stabilité des résultats historiques.
- Changement de périodicité : conserve l'échéance du cycle déjà validé et applique la nouvelle durée après le prochain contrôle. Une correction immédiate nécessite une date manuelle justifiée et tracée. Les échéances passées ne sont pas effacées par cette correction.

« À faire » commence un mois calendaire avant la date limite ; « Échéance à plus d'un mois » désigne une limite plus lointaine, sans prétendre qu'un rendez-vous existe. Le lendemain de la limite marque le retard. Les historiques de modifications de dates gardent les valeurs, la raison, l'auteur déclaré et le compte de saisie.

## Migration à préparer, pas encore exécutée sur Supabase

Avant toute utilisation réelle : export JSON des données actuelles, essais sur une copie isolée, vérification des comptes et documents, puis accord sur les règles ci-dessus et la publication.

Le script **supabase/003_tracking_guard.sql**, à examiner après les scripts existants `001_schema.sql` et `002_workspace.sql`, ajoute une protection serveur du registre. Il ne supprime ni table ni donnée et n'active aucun envoi. Il refuse notamment la suppression d'une échéance historique, son altération silencieuse, une nouvelle réalisation « Introuvable » et le retour à un ancien format après passage au format 2. Les anciens clients doivent être fermés/actualisés lors de la future mise en service. Ne pas rejouer les scripts initiaux sur la base existante. Ce nouveau script a été testé sur PostgreSQL embarqué, pas exécuté sur le projet de production.

Dans **⚙ > Données**, le diagnostic présente les anciens « Introuvable », les dates à valider et l'historique sans échéance liée. L'action de migration nécessite une confirmation et une sauvegarde préalable. Elle ajoute des événements de traçabilité, archive le matériel dont le dernier état était introuvable et conserve les contrôles d'origine et leurs documents. Elle ne valide aucune périodicité ni date ancienne à votre place. Ce parcours a été essayé uniquement avec des données fictives locales.

La connexion centralisée, Auth/RLS et les contrôles de révision sont conservés. Ils sont testés avec des réponses simulées et une base de test ; les identités et droits du projet réel devront être vérifiés lors de la recette. Aucun secret nouveau n'est ajouté au navigateur ou au dépôt.

## Vérifications effectuées et limites

Tests automatiques : anciens contrôles dépassés, contrôles tardifs, doublons de réalisation, archivage sans contrôle, réactivation sans délai artificiel, conservation des cohortes après archivage/changement de périodicité, migration additive et conservation des documents. Essais Chromium sur ordinateur et mobile : formulaires, tableaux de bord, liens, rechargement, sauvegarde et migration. Tests PostgreSQL embarqué : Auth/RLS existants et protection du nouveau registre.

La case **Rester connecté sur cet appareil**, déjà demandée, est aussi préparée : session persistante si cochée, session de l'onglet sinon ; le mot de passe n'est jamais enregistré. La déconnexion supprime les jetons de connexion, pas les sauvegardes VGP. Tests avec Auth simulé, sans connexion réelle. À utiliser uniquement sur un appareil personnel autorisé ; pas sur un poste partagé.

Un champ rendez-vous ajouté à une donnée de test ne change pas le calcul d'échéance ; l'écran de prise de rendez-vous reste à développer. Aucun journal inviolable ni signature électronique n'est ajouté : sélectionner un nom reste une déclaration.

## Suite, après vos essais

1. Responsabilités distinctes, rendez-vous, blocages et accueil « Mes actions » avec filtres mémorisés.
2. Traçabilité des commentaires et réparations, puis import Excel avec aperçu complet et comparaison aux fiches existantes. Votre fichier actuel ne contient **pas de contrôles** : la refonte d'import n'est pas terminée dans cette étape ; les noms de colonnes ou un exemple anonymisé aideront à traiter l'échec rencontré.
3. Relances groupées et historique réel des envois, après configuration informatique Microsoft 365 et tâche serveur. Aucun envoi pendant le développement. Les campagnes viendront ensuite.

Les pièces jointes restent limitées à 1 Mo. Proposition pour une étape suivante : PDF jusqu'à 5 Mo dans un espace Supabase Storage privé avec droits par espace de travail et liens temporaires, après validation des besoins et quotas par l'informatique. Augmenter simplement la limite des fichiers encodés dans le JSON actuel fragiliserait le stockage.
