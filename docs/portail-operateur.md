# Portail opérateur des contenants

URL du site publié : `https://bricemerlier-debug.github.io/vgp/operateur.html`. Cette page utilise la même configuration Supabase publique (`cloud-config.js`) que l'application principale et n'utilise aucune clé secrète.

## Mise en service dans Supabase

1. Dans le SQL Editor du projet déjà utilisé par l'application, exécuter `supabase/018_operator_portal.sql` après `supabase/015_container_fast_writes.sql`. Le script est transactionnel : il ajoute le rôle `operateur` et les fonctions ciblées sans déplacer les Contenants ni leurs interventions.
2. Dans **Authentication → Users**, inviter ou créer le compte personnel de l'opérateur. Relever son UUID après création. Ne pas utiliser un compte administrateur partagé.
3. Dans le SQL Editor, ajouter l'utilisateur à l'espace de travail existant (remplacer les deux UUID) :

```sql
insert into public.workspace_members (workspace_id,user_id,role)
values ('UUID_ESPACE_EXISTANT','UUID_COMPTE_OPERATEUR','operateur');
```

L'UUID de l'espace est la valeur `workspaceId` de `cloud-config.js`. Ne créer ni deuxième espace ni deuxième base de données. Un compte dispose d'un seul rôle dans cet espace ; si l'utilisateur existe déjà comme administrateur, créer un compte séparé.

## Fonctionnement et droits

L'opérateur se connecte depuis la page dédiée, choisit un numéro de contenant proposé, un seul type parmi Préventif, Curatif et Sécurité, puis écrit son commentaire. Le serveur affecte l'heure de Paris, l'identifiant du compte, son e-mail et le prochain numéro d'intervention. La réponse de la fonction SQL confirme l'enregistrement. Une même requête répétée ne crée pas de doublon.

La correction modifie l'intervention existante et garde les anciennes valeurs, l'auteur et l'heure dans `operatorCorrections`. Les interventions sont stockées dans `workspace_state.payload.containers[].interventions`, comme celles de l'application principale. Elles apparaissent dans la rubrique Contenants au prochain chargement ou à la prochaine actualisation. Les vues et calculs existants lisent ce même historique.

Le rôle `operateur` est invisible pour les anciennes politiques RLS et fonctions d'administration via `workspace_role`. Il ne peut utiliser que `operator_portal_data` (numéros des contenants actifs et ses propres interventions) et `operator_save_intervention_v2` (création ou correction de ses interventions avec la checklist du préventif). Les contrôles d'accès s'exécutent dans Supabase, y compris si les API sont appelées directement hors de l'interface.

## Vérification après activation

Avec un compte opérateur réel, contrôler la connexion, la recherche d'un contenant, l'enregistrement, la correction et l'apparition dans la rubrique Contenants avec un compte administrateur. Essayer aussi `read_state` et `write_containers` avec le jeton opérateur : les appels doivent être refusés. Les tests automatisés locaux sont `node tests/operator_portal_database.mjs` et `python tests/operator_portal_browser.py` (serveur local sur le port 8123 pour le test navigateur).

Pour choisir les contrôleurs depuis le portail, exécuter ensuite `supabase/022_operator_controllers.sql` dans le même projet. Le premier contrôleur est obligatoire, le second facultatif. Les noms proposés proviennent des fiches et de l’historique des contrôleurs de contenants ; la base valide les choix et conserve le contrôleur précédent dans les corrections. Après installation, le portail affiche la MAJ 080.
