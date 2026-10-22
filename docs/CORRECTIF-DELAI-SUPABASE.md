# Enregistrement interrompu : « canceling statement due to statement timeout »

Cette erreur indique que Supabase a interrompu une requête trop longue. Elle peut toucher une simple fiche ou un import. Dans ce cas, la transaction SQL est annulée : aucun succès ne doit être annoncé. Il faut vérifier les données après actualisation avant tout nouvel essai.

## Activer le correctif sur le projet existant

1. Ouvrir le projet concerné dans [Supabase](https://supabase.com/dashboard).
2. Aller dans **SQL Editor > New query**.
3. Copier **tout** le contenu de [027_equipment_fast_save.sql](../supabase/027_equipment_fast_save.sql), le coller et cliquer **Run**. Ce script reprend le correctif 004 et accélère aussi les sauvegardes d'une seule fiche. Le projet doit déjà posséder la protection 003. Ne pas rejouer 001/002 et ne pas recréer l'espace de travail.
4. Si SQL Editor affiche une erreur, conserver son message. Le script est transactionnel : en cas d'échec, son installation est annulée.
5. Revenir sur le site, faire **Ctrl+F5**, vérifier que la fiche n'a pas déjà été enregistrée, puis réessayer une seule fois. Pour un import, sélectionner de nouveau le fichier et vérifier l'aperçu et les confirmations.

L'accès administrateur Supabase est nécessaire à cette manipulation. Le code du site ne possède que la clé publique autorisée ; il ne peut pas modifier les fonctions SQL du serveur. Ne fournir aucune clé secrète ou mot de passe dans la conversation.

## Ce qui change

L'ancienne fonction rescannait le JSON de tout le parc pour chaque fiche et chaque contrôle. Même après le correctif 004, une modification locale vérifiait et reprojetait encore toutes les fiches. Pour un grand parc, ces traitements répétés peuvent dépasser le délai serveur.

Le correctif indexe les équipements du document, puis concentre les vérifications métier et les écritures de projection sur les fiches modifiées. Il conserve les contrôles déjà présents ; seules les nouvelles réalisations sont insérées.

La même transaction protège l'instantané, ses projections et l'historique. Les droits Auth/RLS, les contrôles de révision, la conservation des équipements, l'immuabilité des contrôles/PDF, les échéances historiques et les restrictions de migration restent actifs. Aucun tableau ou équipement n'est supprimé par le script. Il n'augmente pas globalement les droits ou les délais et n'active aucun envoi de mail.

## Vérifications

Tests sur PostgreSQL embarqué, avec données fictives : droits admin/editor/reader/anonyme, conflits de révision, refus des doublons, historique immuable, conservation des justificatifs APAVE, reprise des dates et annulation transactionnelle des écritures invalides. Une modification isolée sur un parc de 900 équipements et 5,6 Mo de JSON a été enregistrée en moins d'une seconde dans cet environnement de test. Ce temps ne constitue pas une garantie pour l'hébergement réel ; l'activation et le résultat doivent être vérifiés dans le projet Supabase utilisé.

Le site affiche l'erreur en français et propose le lien vers le correctif. Si le délai serveur persiste après installation, consulter les journaux et les écritures bloquées dans Supabase ; une attente de verrou ou une charge du serveur ne peut pas être corrigée par le code du navigateur. En cas de coupure réseau sans réponse du serveur, actualiser avant de réessayer : ce cas diffère d'une annulation SQL explicitement retournée.
