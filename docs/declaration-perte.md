# Déclarer un matériel perdu depuis un rappel

Installer `supabase/024_recipient_loss_declaration.sql` après le schéma et les protections métier (`001`, `003` et `004`). Le fichier est transactionnel et peut être réexécuté. Il crée trois fonctions ciblées et une table privée de liens ; il ne change aucun équipement lors de son installation.

## Parcours

Dans Mails, préparer le message avec un matériel et son propriétaire. L’adresse destinataire est reprise de la fiche et ne peut pas être remplacée. Le bouton envoie un vrai rappel après confirmation.

Lors de l’envoi, de la copie ou de l’export du message, le site demande à Supabase un lien destiné à cette personne et à cet équipement. Le lien apparaît dans le bouton **Déclarer ce matériel perdu** et dans la version texte du mail. L’ouverture du formulaire ne modifie rien, y compris si une messagerie analyse automatiquement le lien.

Le destinataire renseigne son nom et ses recherches, dessine sa signature ou signe avec son nom, puis accepte l’attestation et valide. La fiche passe immédiatement en **Équipement perdu**. Le serveur ajoute un événement `loss-declaration` avec un numéro de rapport, la signature, l’identité déclarée, l’adresse de réception du lien, l’attestation, les recherches et l’heure de Paris. Le rapport PDF existant reprend ces éléments, y compris la signature. Aucun contrôle VGP n’est ajouté. Les échéances ouvertes sont clôturées comme perdues et les rappels de ce matériel sont annulés.

## Portée du lien

Le destinataire n’a pas besoin d’un compte d’administration. Le formulaire reconnaît le lien personnel reçu par mail et enregistre le nom qu’il déclare ; il ne prétend pas authentifier ce nom par un fournisseur d’identité.

Le jeton aléatoire est placé dans le fragment de l’URL et seule son empreinte SHA-256 est stockée dans la table privée. Il expire au bout de 35 jours et ne permet qu’une déclaration. Les lectures publiques renvoient seulement le matériel concerné et l’adresse de réception, jamais le parc ou les signatures des autres personnes. Les appels de création restent réservés aux administrateurs et éditeurs ; pour un rappel réel, l’adresse doit appartenir à un propriétaire associé à la fiche. Un changement de propriétaire, d’adresse, d’identification, de cycle de contrôle ou d’historique d’archivage invalide l’ancien lien.

L’enregistrement verrouille le lien et la fiche dans la même transaction. En cas de réponse réseau perdue, rouvrir ou valider le même lien renvoie la confirmation déjà enregistrée, sans doublon. Les archives restent protégées par les contrôles d’immutabilité existants.

## Vérifications

- `node tests/recipient_loss_database.mjs` : droits, lien limité, signature, perte réelle, essai sans effet, idempotence, expiration et réaffectation.
- `node --test tests/vgp_mail.test.mjs` : bouton dans le HTML et le texte, URL de formulaire, API publique limitée et format du message.
- `VGP_TEST_PORT=8125 python tests/recipient_loss_browser.py` : parcours d’envoi réel simulé, formulaire signé, rapport et affichage mobile, avec tous les services distants interceptés.
