# Gemini CLI - Journal des modifications

## [1.1.47] - 2026-02-19
### Ajouté
- **Affichage du chemin du backlog** : Le lien complet vers le fichier `backlog.txt` est désormais affiché sous la barre de téléchargement dans l'interface utilisateur.

## [1.1.46] - 2026-02-19
### Ajouté
- **Persistence du backlog** : Le backlog des téléchargements en attente est désormais stocké dans un fichier `backlog.txt` sur le bureau de l'utilisateur. Il est chargé au démarrage de l'application et mis à jour lors de chaque ajout ou complétion de téléchargement.

## [1.1.45] - 2026-02-19
### Ajouté
- **Barre de recherche sur la vue lecture** : Intégration de la barre de téléchargement de vidéos directement dans la vue de lecture pour faciliter le téléchargement sans repasser par l'accueil.

## [1.1.44] - 2026-02-18
### Changé
- **Limite d'historique** : La longueur de l'historique est désormais dynamique et limitée à 80% du nombre total de vidéos en base pour une meilleure gestion de l'espace.

## [1.1.41] - 2026-02-17
### Ajouté
- **Téléchargement de chaîne** : Ajout d'un bouton "Télécharger la chaîne" dans la vue par chaîne pour faciliter l'archivage complet.

## [1.1.40] - 2026-02-17
### Changé
- **Suggestions de vidéos** : Affichage de seulement 5 vidéos aléatoires dans la barre latérale pour améliorer la navigation.

## [1.1.37-6] - 2026-02-15
### Ajouté
- **Système d'historique** : Suivi des vidéos visionnées avec une nouvelle vue dédiée `/history`.
- **Détection de navigateur pour les cookies** : Utilisation automatique des cookies de Firefox (prioritaire) ou Chrome pour les téléchargements.
- **Publication automatique** : Job GitHub Action pour publier la release une fois les builds terminés.
- **Migration vers Bun** : Remplacement de npm par Bun pour la gestion des paquets, les scripts et les tests. Utilisation de Bun dans le workflow CI/CD.

## [1.1.37-5] - 2026-02-15
### Ajouté
- **Tests automatisés** : Suite de tests unitaires pour la file d'attente, la base de données et le module de téléchargement.
- **Modularité** : Extraction de la logique de téléchargement (`downloader.js`) et de mise à jour (`updater.js`) pour une meilleure testabilité.

### Corrigé
- **Séquence de démarrage** : Correction d'une erreur de référence au boot et ajout d'une attente pour les fichiers essentiels.
- **Fiabilité yt-dlp** : Amélioration de la gestion des arguments et des chemins Windows pour éviter les échecs d'exécution.

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

