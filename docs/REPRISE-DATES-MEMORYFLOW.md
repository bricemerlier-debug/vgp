# Associer les dernières dates MemoryFlow aux équipements existants

Dans le site : **⚙ > Données > Associer les dernières dates MemoryFlow aux fiches existantes**. Sélectionner directement `export-complet (4).csv` ; il n'est pas nécessaire de convertir ce fichier en Excel. Les exports équivalents `.xlsx` sont également acceptés.

## Vérifier puis associer

1. Exporter une sauvegarde des données actuelles avant la reprise.
2. Sélectionner le CSV et vérifier l'aperçu : ID MemoryFlow, numéro interne, fiche du site, dernière date déclarée, échéance et anomalies.
3. Confirmer les **échéances et périodicités source comme base de suivi de l'entreprise**. L'import ne les déclare pas validées sans cette confirmation.
4. Corriger les erreurs ou choisir explicitement **Associer uniquement les fiches valides**.
5. Cliquer **Associer les dernières dates aux fiches**, puis confirmer le récapitulatif.

La dernière date réglementaire est retenue par ID équipement MemoryFlow. Les multiples anciens enregistrements d'un équipement ne créent pas de fiches supplémentaires. Les niveaux 1, 3 et 4 restent exclus de cette reprise VGP. Si plusieurs échéances, numéros ou fréquences se contredisent pour la dernière date, l'association est bloquée.

L'ID MemoryFlow est retrouvé dans les métadonnées source ou les commentaires conservés lors de l'import des fiches. À défaut, numéro interne puis numéro de série servent à retrouver une fiche unique. Les autres identifiants sont vérifiés : aucun rapprochement par nom, aucune association silencieuse en cas de contradiction. L'ID source est ensuite conservé dans un champ dédié pour les reprises ultérieures.

## Ce que contient ce CSV

Le fichier transmis comporte 4 610 lignes, dont 2 029 réglementaires pour 701 équipements. Les 2 581 lignes d'autres niveaux sont ignorées pour cette reprise. Le champ Contrôleur est vide et aucun résultat global n'est fourni. Les observations et informations source sont conservées mais ne sont pas interprétées comme un avis de conformité.

Les dates sont donc affichées dans les fiches comme **Dernière date déclarée dans MemoryFlow**, avec origine, auteur de la reprise et échéance. Elles ne créent pas de contrôle structuré avec résultat et vérificateur, ni de PDF officiel. Les KPI distinguent les dates historiques déclarées des vérifications effectuées avec ces informations. Le graphique mensuel des réalisations dans les délais n'est pas reconstruit depuis ces seules dates, faute d'association historique fiable à une échéance.

Les échéances explicitement confirmées alimentent les statuts **En retard**, **À faire** dans le mois avant la limite et **Échéance à plus d'un mois**. Le taux d'échéances à jour reste distinct de la conformité et du nombre de contrôles documentés. La périodicité reprise de MemoryFlow n'est pas une règle réglementaire inventée ; elle doit être confirmée par l'entreprise.

## Anomalies repérées et protections

Ce CSV contient cinq équipements avec une dernière date future, en 2027 : ils ne peuvent pas être repris comme déjà contrôlés. Une fréquence réglementaire est hors des choix actuels 3/6/9/12 mois et doit être vérifiée.

La comparaison en lecture seule avec le classeur des 859 fiches importables précédemment préparé donne 638 associations possibles, 57 équipements absents de ce classeur, cinq dates futures et une fréquence non prise en charge. Les nombres affichés dans le site dépendent des fiches réellement présentes et des modifications réalisées depuis : l'aperçu est la référence avant confirmation.

Une fiche archivée, du matériel retrouvé nécessitant un nouveau contrôle, une échéance historique non clôturée ou un contrôle exploitable de date identique ou plus récente bloquent une reprise qui pourrait contredire la situation existante. Une ancienne reprise ne remplace pas une date MemoryFlow déjà plus récente.

Les noms, propriétaires, commentaires, contrôles et documents existants restent conservés. Les modifications de dates et périodicité sont tracées. Réimporter les mêmes dernières dates les signale comme déjà présentes. L'enregistrement utilise les protections RLS et le contrôle de révision existants ; aucun nouveau script SQL n'est requis, la protection 003 déjà prévue reste nécessaire.

Tests effectués sur données fictives : CSV avec guillemets/multilignes, dates Excel, regroupement de l'historique, association par identifiants, contradictions, matériel absent/archivé, dates futures, contrôles récents, reprise et rechargement, idempotence, distinction des KPI, conservation d'un contrôle et de sa pièce jointe. La compatibilité de la reprise avec les protections SQL a été vérifiée sur PostgreSQL embarqué. Aucune importation dans la base réelle n'a été effectuée pendant le développement.
