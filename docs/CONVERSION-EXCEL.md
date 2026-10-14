# Télécharger un Excel adapté sans passer par ChatGPT

Les liens vers les fichiers de l'environnement de développement peuvent être indisponibles dans l'interface ChatGPT. La page [conversion-excel.html](https://bricemerlier-debug.github.io/vgp/conversion-excel.html) génère le classeur directement dans le navigateur du PC utilisé.

1. Ouvrir la page de conversion, également accessible depuis **⚙ > Données > Ajouter depuis Excel**.
2. Choisir l'export des équipements MemoryFlow, par exemple `export_equipment_2026_10_13.xlsx`.
3. Cliquer **Télécharger le fichier adapté**. Le navigateur télécharge `Import_VGP_MemoryFlow.xlsx` ; aucune installation n'est nécessaire.
4. Revenir dans l'application, puis importer ce nouveau fichier avec **⚙ > Données > Ajouter depuis Excel**.

L'outil ne demande pas de connexion à Supabase : il ne lit ni ne modifie les données du site. La lecture du fichier, la conversion et la création du téléchargement se font localement. Le fichier source et le classeur produit ne sont envoyés ni à GitHub ni à Supabase et ne sont pas publiés dans le dépôt.

Le résultat contient les feuilles **A importer**, **A corriger**, **Export original** et **Lire avant import**. Les numéros internes manquants et toutes les lignes qui partagent un numéro interne ou de série sont isolés pour vérification, sans choisir arbitrairement un exemplaire. Les noms sont conservés et aucune fusion n'est faite.

L'export du 13 octobre transmis contient 956 équipements : 859 fiches sont importables et 97 doivent être corrigées, avant comparaison avec le matériel déjà présent sur le site. Ces nombres ont été vérifiés en lecture seule avec les règles d'import du site. La conversion n'effectue aucune importation réelle.

Le format attendu est celui de l'export **des équipements**, avec Nom, Numéro interne, N° de série, ID et Date de mise en service. Les exports de contrôles au format différent sont refusés avec une indication du fichier attendu.

Les colonnes de dernier contrôle, résultat, vérificateur et prochaine échéance restent vides : une date de mise en service n'est pas un contrôle. La périodicité reste vide si elle n'est pas fournie ; le site propose actuellement 12 mois par défaut, sans validation. Cette durée doit être adaptée et validée par l'entreprise. Les détails source restent dans Commentaire et Export original ; les nombres sont écrits comme texte, sans inventer les zéros initiaux déjà absents du fichier.

Tests : conversion et relecture XLSX, acceptation des lignes valides par le parseur d'import, séparation des erreurs, conservation des informations, absence de formule exécutable, téléchargement navigateur réel sur données fictives, absence de requête réseau pendant la conversion et affichage mobile.
