# Planning 5×8

Le planning utilise exclusivement la feuille **calendrier global**, à partir du **1er octobre 2026**. Les feuilles masquées, les sous-équipes et les colonnes « Poste sous-équipe » sont ignorées, selon la référence confirmée par l’utilisateur. Aucun calendrier d’entreprise n’est livré dans le dépôt public.

## Activation et premier import

1. Dans le SQL Editor du projet Supabase existant, exécuter [008_shift_calendar.sql](../supabase/008_shift_calendar.sql). La migration est additive et peut être réexécutée. Elle utilise les espaces, l’authentification et les rôles du script 001 existant ; elle n’exige pas de réinstaller les scripts APAVE.
2. Actualiser le site avec Ctrl + F5, ouvrir **Planning 5×8 → Importer un planning 5×8**.
3. Sélectionner le classeur officiel `.xlsm` ou `.xlsx`, choisir au besoin les dates de début et de fin, puis consulter l’aperçu. Le chargement propose automatiquement une analyse ; le bouton Analyser permet de changer la période.
4. Vérifier les affectations, cocher la confirmation et importer. Si une affectation diffère de celle déjà enregistrée, une confirmation supplémentaire est obligatoire. Une cellule vide peut remplacer une affectation connue uniquement avec cette confirmation explicite.

Le fichier Excel est lu localement avec le lecteur existant du site. Les macros ne sont jamais exécutées. Le classeur, ses formules, ses feuilles masquées et son contenu binaire ne sont pas envoyés au serveur ni publiés sur GitHub. Seules les affectations confirmées, le nom du fichier, son empreinte SHA-256, la feuille de référence et les coordonnées des cellules sources sont enregistrés. Limite : 10 Mo par classeur, 20 000 affectations par import.

## Lecture du format officiel

Le lecteur repère les blocs d’en-tête `M S N A B C D E`, quelle que soit leur position dans la feuille. La cellule date se trouve immédiatement à gauche de M. Il lit uniquement les jours datés du bloc, sans reconstruire les jours manquants ni recalculer les formules Excel : les valeurs enregistrées dans le fichier font référence.

- Une lettre d’équipe dans M, S ou N désigne son poste principal.
- Une lettre dans sa propre colonne d’équipe désigne le **repos**, conservé comme R.
- CP, JF, RTT et F restent des codes distincts ; ils ne deviennent pas des postes travaillés. Une absence explicitement inscrite dans la colonne de l’équipe prime sur la rotation M/S/N imprimée. L’aperçu compte ces cas.
- Une case vide sans autre affectation explicite reste **Non renseigné**. Le lecteur ne déduit pas un repos à partir de cette seule absence.
- Plusieurs postes pour la même équipe, une date invalide, un code inconnu ou des affectations contradictoires bloquent l’analyse. Les doublons strictement identiques dans le classeur sont regroupés ; le serveur refuse tout doublon résiduel.

Les futurs classeurs conservant cette disposition peuvent être importés sans modification du code. Les périodes précédant le 01/10/2026 sont exclues et aucune rotation n’est extrapolée au-delà des dates présentes.

## Consultation et horaires

L’accueil affiche l’équipe en poste, le type de poste, ses horaires, la prochaine relève et l’équipe suivante. La rubrique dédiée offre une date de départ, une vue sur 7 ou 30 jours, le changement de mois, un filtre d’équipe et ses prochaines présences connues. La date actuelle et le poste en cours sont distingués. L’interface fonctionne sur PC et téléphone.

Les horaires sont **05 h–13 h**, **13 h–21 h**, **21 h–05 h le lendemain**, dans **Europe/Paris**, indépendamment du fuseau du navigateur. Entre minuit et 04 h 59, la nuit appartient à la date précédente. Les horodatages sont calculés sur les heures locales du début et de la fin : une nuit traversant le changement d’heure dure donc réellement 7 ou 9 heures. L’affichage est réévalué chaque seconde, avec mise à jour du contenu au changement de minute/poste et au retour sur la page.

Sans affectation fiable pour un poste, l’application affiche **Planning non renseigné**. Lorsque toutes les équipes ont une affectation connue et qu’aucune n’occupe le poste — notamment en cas de congés ou de jour férié — elle affiche **Aucune équipe prévue**. Les données partagées sont relues toutes les minutes, hors saisie d’import, et via le bouton Actualiser.

## Stockage, historique et protections

Trois tables séparées du parc VGP :

| Table | Contenu |
|---|---|
| `shift_calendar_days` | Date du poste, équipe, code, début/fin UTC, cellule source et révision de l’import |
| `shift_calendar_imports` | Auteur, date/heure, fichier et feuille sources, valeurs avant/après chaque modification |
| `shift_calendar_state` | Révision propre au planning de l’espace |

Les fonctions `read_shift_calendar` et `import_shift_calendar` utilisent l’authentification et l’appartenance à l’espace existantes. Les membres autorisés peuvent lire ; seuls les administrateurs/éditeurs peuvent importer. Les tables ont la RLS activée et aucune écriture directe n’est accordée aux clients. Les utilisateurs anonymes et les membres d’un autre espace n’ont pas accès au planning.

L’import ne touche ni `workspace_state`, ni les équipements, propriétaires, contrôleurs, contrôles, documents APAVE ou échéances VGP. Il modifie uniquement les couples date/équipe transmis et différents ; les autres périodes restent intactes. L’historique conserve les valeurs précédentes, y compris lors d’un échange d’équipes ou d’un remplacement par une case inconnue. Toutes les mises à jour sont dans une transaction ; une erreur annule l’ensemble. Une révision évite les écrasements entre appareils. Si le réseau coupe après validation, actualiser puis réanalyser avant de recommencer.

Un calendrier déjà présent n’ajoute aucune ligne ni révision : l’aperçu le signale et désactive l’import. La comparaison porte sur les affectations, pas seulement sur le nom ou l’empreinte du fichier, ce qui permet les corrections ultérieures d’un même classeur.

En mode local de démonstration, les mêmes fonctions utilisent une clé dédiée `vgp-shift-calendar-v1`. Ce mode ne synchronise pas les appareils ; le mode Supabase est nécessaire en usage partagé.

## Préparation de la suite

`shift-calendar.mjs` expose les fonctions pures `shiftCurrent`, `shiftSlot`, `shiftUpcoming`, `shiftSlotState`, `parseShiftGlobal` et `shiftImportPreview`. Les dates et les équipes A–E sont compatibles avec les fiches VGP. Cette séparation permettra de croiser ultérieurement les prochaines présences avec les échéances, les secteurs, les localisations et les disponibilités de Métrologie. **Aucun planificateur automatique de recherches d’équipements n’est développé ici.**

## Vérification

```sh
npm run build
node tests/shift_calendar.test.mjs
node tests/shift_calendar_database.mjs
python tests/shift_calendar_browser.py
python tests/shift_calendar_cloud_browser.py
```

Les tests navigateur utilisent Chromium et un serveur local sur le port 8000. Les tests SQL utilisent PostgreSQL local via PGlite, sans aucune écriture en production. Ils couvrent les relèves, la nuit de la veille, les changements de mois et d’année, les changements d’heure, l’absence de données, les CP/JF, les doublons, les conflits concurrents, les protections RLS, l’historique et la préservation du parc.

Un test séparé peut vérifier un classeur réel sans le publier :

```sh
python tests/shift_calendar_reference.py /chemin/prive/calendrier.xlsm /chemin/prive/attentes.json
```

Les attentes contrôlées indépendamment contiennent les bornes de période, le nombre de jours/affectations, de cases inconnues et d’absences prioritaires, ainsi que des échantillons date/équipe/code. Le classeur réel et ces attentes restent hors du dépôt public. Pour le fichier fourni, la lecture a été vérifiée dans Chromium ; aucune affectation n’est préchargée dans le site public. Le premier enregistrement partagé doit être confirmé depuis l’interface, après installation de la migration.

Le dépôt n’a pas de numéro de version applicative ni de CHANGELOG central : la version livrée est identifiée par son commit Git.
