# Mails de rappel VGP

L’onglet Mails affiche les quatre modèles enregistrés (J−30, J−14, J−7 et jour J), puis un formulaire de test et son aperçu. Le destinataire vient directement du propriétaire associé à l’équipement et de son adresse dans `ownerContacts`. Il n’y a aucune affectation de contact supplémentaire.

Le destinataire du test peut être remplacé sans modifier la fiche propriétaire. Le test porte `[TEST]` dans son objet et une indication visible dans son contenu. Il n’enregistre aucun contrôle et ne prépare aucun envoi automatique.

La photo ajoutée est compressée en JPEG et conservée sur l’équipement dans `mailPhoto`. Le logo et la photo sont joints au message avec des références CID pour qu’ils restent dans le mail sans URL d’image temporaire. L’aperçu affiche ces mêmes images. Les modèles personnalisés sont conservés ; les anciens modèles livrés par défaut sont remplacés par leur version simplifiée seulement s’ils n’ont pas été modifiés.

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
