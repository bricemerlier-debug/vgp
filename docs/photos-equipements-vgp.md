# Photos des équipements VGP

Exécuter [029_equipment_photos.sql](../supabase/029_equipment_photos.sql) dans le SQL Editor du projet Supabase avant d'ajouter une photo depuis le site. Le script crée un bucket privé `equipment-photos` et une table de correspondance indépendante de l'instantané VGP. Il n'active aucun envoi de mail.

Sur la fiche équipement, **Ajouter une photo** accepte les JPEG, PNG et WebP jusqu'à 12 Mo. Le navigateur convertit l'image en JPEG de 200 Ko maximum avant l'envoi. Les lecteurs peuvent voir la photo ; seuls les administrateurs et éditeurs peuvent l'ajouter, la remplacer ou la retirer. Le remplacement et le retrait nettoient l'ancienne copie après la mise à jour de la fiche. En mode local, la photo est enregistrée dans IndexedDB sur cet appareil.

L'aperçu du mail de test charge automatiquement la photo enregistrée pour l'équipement choisi. L'envoi, la copie et le téléchargement du message chargent de nouveau la photo avant de préparer le mail, afin d'éviter d'utiliser une ancienne image. Une photo absente ou indisponible n'est jamais remplacée par une image inventée.
