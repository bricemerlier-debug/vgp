# Import interrompu : « canceling statement due to statement timeout »

Cette erreur indique que Supabase a interrompu une requête trop longue. Le fichier peut être correctement analysé et ses associations trouvées sans que l'enregistrement aboutisse. Dans ce cas, la transaction SQL est annulée : aucun succès ne doit être annoncé et l'import doit être relancé après correction.

## Activer le correctif sur le projet existant

1. Ouvrir le projet concerné dans [Supabase](https://supabase.com/dashboard).
2. Aller dans **SQL Editor > New query**.
3. Copier **tout** le contenu de [004_fast_writes.sql](../supabase/004_fast_writes.sql), le coller et cliquer **Run**. Exécuter uniquement ce correctif sur le projet existant, qui possède déjà la protection 003. Ne pas rejouer 001/002 et ne pas recréer l'espace de travail.
4. Si SQL Editor affiche une erreur, conserver son message. Le script est transactionnel : en cas d'échec, son installation est annulée.
5. Revenir sur le site, faire **Ctrl+F5**, sélectionner de nouveau le CSV des contrôles, vérifier l'aperçu et les confirmations, puis relancer l'association.

L'accès administrateur Supabase est nécessaire à cette manipulation. Le code du site ne possède que la clé publique autorisée ; il ne peut pas modifier les fonctions SQL du serveur. Ne fournir aucune clé secrète ou mot de passe dans la conversation.

## Ce qui change

L'ancienne fonction rescannait le JSON de tout le parc pour chaque fiche et chaque contrôle. Elle réécrivait également les projections par de nombreuses petites requêtes et supprimait/réinsérait l'ensemble des projections de contrôle, au sein d'une transaction. Pour un grand import, ces traitements répétés peuvent dépasser le délai serveur.

Le correctif indexe les équipements et contrôles du document une fois, puis recherche les identifiants dans ces index. Il effectue les écritures de projection en une opération ensembliste, évite de réécrire les fiches inchangées et conserve les contrôles déjà présents. Les nouvelles réalisations seules sont insérées.

La même transaction protège l'instantané, ses projections et l'historique. Les droits Auth/RLS, les contrôles de révision, la conservation des équipements, l'immuabilité des contrôles/PDF, les échéances historiques et les restrictions de migration restent actifs. Aucun tableau ou équipement n'est supprimé par le script. Il n'augmente pas globalement les droits ou les délais et n'active aucun envoi de mail.

## Vérifications

Tests sur PostgreSQL embarqué, avec données fictives : droits admin/editor/reader/anonyme, conflits de révision, refus des doublons, historique immuable, conservation des justificatifs, reprise des dates et annulation transactionnelle des écritures invalides. Un parc de 900 équipements avec 640 reprises et 5,5 Mo de JSON a été enregistré en environ 0,5 seconde dans cet environnement de test. Ce temps ne constitue pas une garantie pour l'hébergement réel ; l'activation et le résultat doivent être vérifiés dans le projet Supabase utilisé.

Le site affiche désormais l'erreur en français, propose le lien vers le correctif et indique l'enregistrement en cours. Il ne présente pas une analyse de fichier comme une importation réussie. En cas de coupure réseau sans réponse du serveur, actualiser avant de réessayer : ce cas diffère d'une annulation SQL explicitement retournée.
