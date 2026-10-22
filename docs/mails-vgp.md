# Mails de rappel VGP

L’onglet Mails affiche les cinq modèles enregistrés (J−30, J−14, J−7, jour J et retard tous les 7 jours), puis un formulaire de test et son aperçu. Le destinataire vient directement du propriétaire associé à l’équipement et de son adresse dans `ownerContacts`. Il n’y a aucune affectation de contact supplémentaire.

Le destinataire du test peut être remplacé sans modifier la fiche propriétaire. Le test porte `[TEST]` dans son objet et une indication visible dans son contenu. Il n’enregistre aucun contrôle et ne prépare aucun envoi automatique.

Le mode TEST est sélectionné par défaut. Le mode réel est manuel, demande une confirmation et envoie uniquement au propriétaire associé à l’équipement. Les deux liens du mail ouvrent des formulaires de perte et de mise au rebut. Avec les scripts Supabase 024, 025 et 026 installés, une déclaration réelle signée archive l’équipement, crée un rapport PDF consultable dans l’historique des contrôles et associe le déclarant à une fiche contrôleur. Une validation depuis un mail TEST ne modifie aucune fiche. Aucun rappel automatique n’est activé.

La photo déjà enregistrée sur l’équipement dans `mailPhoto` est automatiquement intégrée ; aucun ajout de photo n’est demandé dans Mails. Le logo et la photo sont joints au message avec des références CID pour qu’ils restent dans le mail sans URL d’image temporaire. L’aperçu affiche ces mêmes images. Les modèles personnalisés sont conservés ; les anciens modèles livrés par défaut sont remplacés par leur version simplifiée seulement s’ils n’ont pas été modifiés.

## Activer le test depuis Gmail

La configuration initiale est nécessaire une fois pour le site. Aucun script SQL n’est requis.

1. Dans Google Cloud, créer ou choisir un projet et activer **Gmail API**.
2. Configurer l’écran de consentement OAuth. Si l’application est en mode test, ajouter le compte Gmail expéditeur aux utilisateurs de test. Le destinataire n’a pas besoin d’être utilisateur de test.
3. Créer un **identifiant client OAuth 2.0, Application Web** et autoriser l’origine HTTPS exacte du site dans les origines JavaScript autorisées. Pour un site GitHub Pages, l’origine est `https://nom-utilisateur.github.io` sans le chemin du dépôt. Ajouter séparément l’origine locale pour les essais locaux si nécessaire.
4. Reporter l’identifiant public se terminant par `.apps.googleusercontent.com` dans `gmailClientId` de `mail-config.js`, puis publier ce fichier. Ne pas saisir de secret client ou de mot de passe.
5. Dans Mails, choisir le matériel, vérifier les deux adresses et le rendu, cliquer sur **Connecter Gmail** et autoriser le compte expéditeur. Cliquer ensuite sur **Envoyer le test** pour cet unique message.

Le site demande uniquement les autorisations d’envoi Gmail et de lecture de l’adresse du compte. L’adresse Google connectée doit correspondre à l’expéditeur saisi. Le jeton est conservé en mémoire jusqu’à expiration ou rechargement ; il n’est enregistré ni dans le navigateur, ni dans Supabase. Une erreur réseau après l’envoi bloque un nouvel essai dans l’écran : consulter les messages envoyés de Gmail avant de recommencer. Aucun réessai automatique n’est effectué.

Sans configuration Gmail, l’aperçu, la copie mise en forme et le téléchargement `.eml` restent disponibles ; le site indique que l’envoi direct n’est pas activé. Le fichier `.eml` contient le HTML, le texte, le logo et la photo. La prise en charge de son ouverture comme brouillon dépend de la messagerie.

Pour préremplir un test, un lien peut contenir `?mailFrom=adresse&mailTo=adresse#mailSettings`. Les paramètres sont retirés de l’URL à l’ouverture et ne sont pas enregistrés avec les modèles.

## Vérifications

`node --test tests/vgp_mail.test.mjs` vérifie le destinataire associé, les modèles, les images MIME, l’échappement HTML et l’envoi Gmail avec un transport fictif. `VGP_TEST_PORT=8125 python tests/mail_templates.py` vérifie l’interface, la photo, l’enregistrement des modèles, le téléchargement, l’envoi entièrement intercepté et la version autonome. Aucun de ces tests n’envoie de mail réel.

## Relances en retard

Le modèle « Contrôle en retard » reprend le logo, la photo et les deux liens de déclaration. La règle du planificateur prévoit J+7, J+14, J+21, etc., après l’échéance courante. Chaque semaine a une clé distincte : une nouvelle exécution le même jour ne double pas l’envoi. Aucun rattrapage des semaines passées. Un nouveau contrôle recalcule le cycle ; un archivage (perte ou rebut) annule les relances.

Le worker actuel reste un simulateur : aucun envoi récurrent réel ne fonctionne en arrière-plan. La connexion Gmail dans le navigateur permet des envois manuels uniquement. Le futur service de production doit exécuter quotidiennement le plan et supporter les étapes négatives (−7, −14, etc.) ; la contrainte SQL initiale des étapes ne les accepte pas encore.

Les mails ne contiennent aucun bouton ni lien vers la fiche interne du matériel. Les liens personnels de perte et de mise au rebut restent disponibles.

Le transport Gmail refuse un message réel sans autorisation explicite du mode réel dans l’écran Mails. Le bouton d’envoi réel affiche une confirmation avant l’envoi. Aucun envoi automatique ou récurrent n’est activé.

## Déclaration de mise au rebut — MAJ 095

Un second encart propose « Déclarer la mise au rebut », avec la même présentation que la perte. Son formulaire distinct demande identité, motif/circonstances, signature et attestation. Le lien est secret, limité au matériel et au destinataire, valable 35 jours et à usage unique. Il nécessite l’installation de `supabase/025_recipient_scrap_declaration.sql` dans le SQL Editor (en plus du 024 pour la perte). Les deux liens sont préparés avant l’envoi ; en absence du 025, l’écran signale l’activation manquante et n’envoie rien.

En mode réel, la déclaration signée archive l’équipement avec le motif « Mis au rebut » et crée le rapport signé. Le rapport est visible et téléchargeable dans l’historique des contrôles. En mode TEST, aucune fiche n’est modifiée.

## Identité du déclarant et fiche contrôleur — MAJ 096

Installer `supabase/026_recipient_declaration_controller.sql` après 024 et 025. Dans les deux formulaires, l’adresse personnelle professionnelle `prenom_nom@goodyear.com` remplace le nom saisi. Le nom est calculé dans le navigateur et recalculé côté serveur. L’adresse est une identité déclarée, sans vérification de possession de cette boîte : elle est enregistrée avec `emailVerified: false`, distinctement du destinataire du lien (qui peut être un groupe Process Team).

Hors test, la déclaration crée ou réutilise une fiche contrôleur par adresse, ou complète une fiche du même nom sans e-mail. Un homonyme ayant une autre adresse reste distinct. Le rapport signé porte son identifiant de contrôleur et apparaît dans sa fiche ainsi que dans l’historique du matériel ; il conserve sa nature de déclaration et ne valide aucune inspection réglementaire. La signature du rapport ne remplace pas la signature permanente du profil. Les nouvelles déclarations sont concernées ; les anciens rapports ne sont pas réattribués.

En mode TEST, aucune fiche contrôleur ni entrée d’historique n’est créée. L’envoi réel est une action manuelle confirmée ; les rappels récurrents restent désactivés.
