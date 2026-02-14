# Gemini CLI - Journal des modifications

## [1.1.37-4] - 2026-02-14
### Ajouté
- **Système de visualisation par chaîne** : Nouvelle route `/channel` permettant de filtrer les vidéos par uploader.
- **Navigation améliorée** : Les noms des créateurs sont désormais des liens cliquables sur la page d'accueil et la page de lecture.
- **Interface contextuelle** : Affichage du nom de la chaîne filtrée dans l'en-tête de la bibliothèque.

### Corrigé
- **Stabilisation du téléchargement** : Implémentation d'une file d'attente asynchrone pour éviter la saturation des ressources.
- **Chemins système** : Correction des chemins vers `ytdlp.exe` et `ffmpeg` pour pointer vers le dossier `AppData` de l'utilisateur.
- **Sécurisation de la route `/watch`** : Ajout de vérifications pour éviter les plantages si les fichiers de métadonnées sont absents.

### Changé
- **Refonte UI/UX** : Intégration de Plyr.io pour le lecteur vidéo et passage à un thème sombre moderne inspiré de YouTube.
- **Consolidation des vues** : Déplacement des fichiers EJS de la racine vers `src/views/` pour une structure plus propre.

## Instructions de développement
- **prepush** : Avant chaque push, s'assurer que la version dans `package.json` est à jour et que les tests passent.

