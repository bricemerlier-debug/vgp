# Types, variantes et anciens noms

Le site conserve le champ **Nom actuel / nom libre**. Aucun nom importé n'est remplacé automatiquement.

## Dans une fiche

- Choisir le **Type d'équipement**, puis la **Variante / modèle** liée à ce type : par exemple Anneau de retournement → M16 ou M30.
- « Créer un type » et « Créer une variante » ajoutent des libellés au catalogue partagé. Les doublons de libellé sont refusés ; une variante d'un autre type ne peut pas être choisie.
- Le nom standard est affiché dans les listes, l'agenda, les alertes, les aperçus de mails et les nouveaux rapports. Le nom libre reste conservé et modifiable. Sans type choisi, le nom libre reste affiché.
- Sur une nouvelle fiche dont le nom est vide, le choix du type propose le nom standard dans le champ libre. Un nom déjà saisi n'est pas écrasé.
- La recherche fonctionne avec l'ancien nom et le nom standard. La famille et les règles de suivi restent distinctes ; choisir un type ne valide aucune périodicité ou conformité.

Les premiers libellés sont Anneau de retournement (M16 et M30) et Manille (sans variante prédéfinie). Ce sont des exemples de nomenclature, aucune grille ou règle réglementaire n'est ajoutée.

## Pour reprendre un grand parc sans faire les fiches une par une

1. Importer d'abord les fiches avec leurs noms existants. L'import Excel reste compatible et ne déduit pas une classification des noms ambigus.
2. Ouvrir **⚙ > Types et standardisation des noms**.
3. Rechercher un nom actuel et cocher les groupes correspondant au même matériel. Les différences de majuscules et d'espaces sont regroupées ; « manille » et « anneau de retournement » ne sont jamais rapprochés automatiquement.
4. Choisir le type et la variante cible. Plusieurs groupes de noms peuvent être sélectionnés ; une recherche suivante conserve les sélections précédentes.
5. Cliquer **Prévisualiser les fiches sélectionnées**. La liste montre le numéro interne, l'ID, l'ancien nom, le secteur et le nom standard proposé. Les archives sont incluses et signalées. Décocher les équipements qui ne correspondent pas au type ou à la variante : un ancien nom identique ne prouve pas une taille identique.
6. Cliquer **Appliquer après vérification**, puis confirmer. L'historique conserve le nom libre, les anciennes et nouvelles classifications, la date et le compte de saisie. Les fiches traitées quittent la liste « à standardiser » ; cocher « Inclure les équipements déjà standardisés » pour les retrouver et les reclasser.

Exemple : si 40 fiches sont effectivement des anneaux M16 et partagent quatre anciens libellés, sélectionner ces quatre groupes permet de les traiter ensemble. Il faut vérifier l'identité réelle du matériel ; le logiciel ne devine pas qu'une manille serait un anneau, ni qu'un anneau sans taille est un M16.

## Données et essais

Les équipements, numéros, noms libres, contrôles, commentaires, justificatifs et échéances restent conservés. Les anciennes échéances mensuelles gardent leur libellé historique ; une classification ne réécrit pas les KPI passés. Les futurs contrôles conservent dans leur instantané le nom standard et le nom libre de la fiche au moment de la saisie.

Les types et variantes sont ajoutés à la sauvegarde existante et au même stockage Supabase que le matériel, avec les droits et contrôles de révision existants. Aucun nouveau script SQL n'est nécessaire pour cette fonctionnalité. La protection SQL 003 déjà demandée reste nécessaire pour écrire en mode centralisé.

Pour un essai local sans toucher à Supabase : télécharger le ZIP du dépôt, l'extraire, puis ouvrir **prototype-vgp.html** dans une fenêtre privée. Ne pas ouvrir `index.html` pour cet essai, car il utilise la connexion centralisée du site. Les exemples locaux sont fictifs. Les données privées disparaissent à la fermeture de la fenêtre ; exporter une sauvegarde pour conserver un essai.

Tests effectués avec des données fictives : création des types/variantes, refus des doublons et associations incohérentes, conservation du nom libre, classification par groupes avec aperçu et exclusion individuelle, recherche sur les deux noms, nouveaux instantanés de contrôle, sauvegarde/rechargement et affichage mobile. Les protections PostgreSQL ont également été testées après classification d'une fiche archivée, sans changement de ses échéances historiques.
