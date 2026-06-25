# Gemini CLI - Journal des modifications

## [1.8.11] - 2026-06-25
### Changé
- **Lecture automatique** : Restauration de la politique d'autoplay sans interaction de l'utilisateur (`no-user-gesture-required`) au niveau d'Electron pour permettre le lancement immédiat des vidéos.

## [1.8.10] - 2026-06-25
### Corrigé
- **Suggestions de vidéos** : Filtrage automatique pour exclure des suggestions (recherche et vidéos similaires) les vidéos qui sont déjà téléchargées dans la bibliothèque locale.

## [1.8.9] - 2026-06-25
### Changé
- **Recherche de similarité** : Utilisation du titre propre d'origine YouTube et du nom de l'uploader comme paramètres de recherche de similarité pour cibler des suggestions plus pertinentes.

## [1.8.8] - 2026-06-25
### Changé
- **Alignement des suggestions** : Refactoring de la structure HTML des cartes de suggestions locales pour correspondre à celle des suggestions en ligne et fermeture d'une balise d'ancrage orpheline dans `view.ejs`.

## [1.8.7] - 2026-06-25
### Corrigé
- **Copie des Assets** : Ajout de la vue `suggestions.ejs` au dictionnaire de synchronisation `assetMap` pour qu'elle soit correctement déployée dans le dossier `userData` au démarrage.

## [1.8.6] - 2026-06-25
### Changé
- **Navigation de suggestion** : Redirection des clics sur les cartes de suggestions similaires vers la route de visionnage/téléchargement direct pour correspondre au comportement des vidéos locales.

## [1.8.5] - 2026-06-25
### Changé
- **Organisation CSS** : Refactoring global et structuration propre de `style.css` par sections fonctionnelles, et migration des styles ad-hoc de `suggestions.ejs` vers la feuille de style centrale.

## [1.8.4] - 2026-06-25
### Corrigé
- **Restauration de session** : Exclusion de la vue `/suggestions` lors de la restauration automatique de la dernière page visitée au démarrage pour éviter les chargements lents.

## [1.8.3] - 2026-06-25
### Ajouté
- **Suggestions de vidéos similaires** : Ajout d'un panneau latéral asynchrone sur la page de lecture proposant des vidéos similaires YouTube prêtes à être téléchargées.

## [1.8.2] - 2026-06-25
### Ajouté
- **Moteur de suggestions** : Intégration d'un moteur de suggestions et de recherche de vidéos YouTube sans connexion, permettant de chercher et de lancer directement des téléchargements depuis l'interface via une nouvelle vue dédiée `/suggestions`.

## [1.8.1] - 2026-06-25
### Changé
- **Console de téléchargement** : Augmentation du buffer de la console logs du front de 100 à 1000 lignes pour permettre un historique de téléchargement plus complet.
- **Streaming vidéo** : Augmentation du buffer vidéo de 2Mo à 10Mo par fragment pour un chargement et une lecture plus fluide de la vidéo.

## [1.7.10] - 2026-06-25
### Ajouté
- **Bouton Voir la chaîne** : Ajout d'un bouton dédié "Voir la chaîne" sur la page de lecture d'une vidéo pour naviguer directement vers les vidéos de l'uploader.

## [1.7.8] - 2026-06-25
### Corrigé
- **Lecture de chaîne/playlist** : Désactivation du filtrage par historique pour les vidéos appartenant à la playlist ou chaîne en cours de lecture afin de permettre le visionnage séquentiel complet et le revisionnage des vidéos déjà vues.

## [1.7.7] - 2026-06-14
### Corrigé
- **Compteur d'historique** : Les variables `historyCount` et `historyLimit` n'étaient pas transmises aux vues EJS. Le badge "Historique (X/Y)" affichait toujours `0/0`.

## [1.7.6] - 2026-06-14
### Corrigé
- **Import hors module** : Suppression des appels `binval.validateBinaries()` et `console.log` au top-level de `downloader.js` qui s'exécutaient à chaque import et causaient des effets de bord.
- **Anti-rejoue** : Correction du filtre d'historique dans la route `/watch` — la vidéo en cours était retirée du `historySet` au lieu d'y être ajoutée, permettant à la vidéo courante de se proposer elle-même comme suivante.

## [1.6.8] - 2026-05-23
### Changé
- **Design System** : Refonte visuelle complète (typographie Inter, Glassmorphism affiné, thèmes sombres vibrants et gradients animés).
- **Architecture CSS** : Centralisation des styles dans `src/client-dist/style.css` servi via une nouvelle route pour éliminer la duplication de code dans les vues EJS.
- **UX** : Ajout de micro-animations fluides au survol des cartes vidéo et des boutons.

## [1.6.7] - 2026-05-09
### Changé
- **Nettoyage Front-end** : Suppression de LogRocket et des balises de scripts obsolètes pour alléger le chargement des pages.

## [1.6.6] - 2026-05-09
### Changé
- **Logs Front-end** : Suppression complète de la console de téléchargement visuelle et des logs de progression Socket.io pour une interface plus épurée.
- **Nettoyage** : Retrait des instructions `console.log` résiduelles dans le processus de rendu.

## [1.6.5] - 2026-05-09
### Corrigé
- **Temps Réel Console** : Activation du mode `--newline` pour yt-dlp et optimisation du traitement Socket.io pour un feedback instantané.
- **Interface Utilisateur** : Restauration du bouton de sélection de dossier et de la console de téléchargement sur toutes les vues (accueil et lecture).

## [1.6.4] - 2026-05-09
### Changé
- **Maintenance** : Mise à jour des dépendances et synchronisation du dépôt.

## [1.6.2] - 2026-05-09
### Corrigé
- **Liaison Console** : Restauration du feedback en temps réel via Socket.io et ajout d'une console de log escamotable dans l'interface utilisateur.
- **Choix du Dossier** : Implémentation d'une boîte de dialogue système pour changer le dossier de téléchargement avec persistance dans la configuration.
- **Extraction d'ID** : Correction de la regex d'extraction des ID YouTube pour éviter les conflits avec les titres contenant des crochets.
- **Compatibilité yt-dlp** : Spécification explicite du runtime Deno pour assurer le fonctionnement des dernières signatures YouTube.
- **Réparation DB** : Ajout d'une détection et correction automatique des entrées corrompues dans la base de données.

## [1.2.5] - 2026-03-13
### Ajouté
- **Système de favoris** : Possibilité de marquer des vidéos comme favorites avec une vue dédiée `/favorites`, un bouton dédié sur le lecteur et des icônes d'action sur la bibliothèque.
- **Compteur de favoris** : Affichage dynamique du nombre de favoris dans la barre de navigation.
- **Gestion AJAX** : Ajout/retrait des favoris sans rechargement de page.

## [1.1.61] - 2026-03-01
### Ajouté
- **File d'attente de lecture (Queue)** : Système permettant d'ajouter des vidéos à une file d'attente prioritaire avec gestion AJAX, retrait automatique après lecture et vue dédiée pour la gestion.
- **Indicateur d'historique** : Affichage dynamique de l'utilisation de l'historique (nombre actuel / limite maximale) dans la barre de navigation.
- **Compteur de file** : Badge dynamique affichant le nombre de vidéos en attente sur toutes les pages.
- **Affichage de version** : La version de l'application est désormais visible dans la barre de navigation.
- **Correction des binaires** : Ajout des fichiers de résolution de binaires (`binaryResolver.js`) manquants dans les versions précédentes.

## [1.1.58] - 2026-02-20
### Ajouté
- **Playlists par chaîne** : Création automatique de playlists basées sur l'uploader pour une meilleure organisation.
- **Lecture séquentielle intelligente** : Le système détecte désormais si une vidéo est lue via une playlist (personnalisée ou par chaîne) et enchaîne automatiquement sur la vidéo suivante de cette liste.

## [1.1.57] - 2026-02-19
### Corrigé
- **Compatibilité Extension** : Correction du port API dans `background.js` (passage de 3000 à 8001) pour correspondre à l'application.
- **Logs Serveur** : Correction du message de log indiquant le mauvais port au démarrage (8000 -> 8001).

## [1.1.56] - 2026-02-19
### Ajouté
- **Moteur de recherche Fuzzy** : Intégration de Fuse.js dans la bibliothèque pour une recherche ultra-rapide et tolérante aux fautes de frappe dans les titres et noms de chaînes.

## [1.1.55] - 2026-02-19
### Corrigé
- **Lancement de yt-dlp** : Suppression de l'option `shell: true` qui provoquait des erreurs "Fichier introuvable" sur certains systèmes Windows.
- **Journalisation des erreurs** : Amélioration de la capture des erreurs lors du lancement des processus externes (spawn) pour faciliter le diagnostic.

## [1.1.54] - 2026-02-19
### Ajouté
- **Système de Playlists** : Création, gestion et lecture de listes de lecture personnalisées.
- **Organisation** : Possibilité d'ajouter/retirer des vidéos des playlists directement depuis l'interface de lecture.

## [1.1.53] - 2026-02-19
### Ajouté
- **Raccourcis clavier YouTube** : Support des touches `k`, `j`, `l`, `f`, `m`, `Maj+N` et `0-9` pour une navigation identique à YouTube.
- **Persistance de lecture** : Sauvegarde automatique de la position de lecture pour reprendre chaque vidéo là où elle s'était arrêtée.
- **Restauration de session** : L'application mémorise la dernière page consultée et y revient automatiquement au démarrage.
- **Mise à jour forcée des assets** : Système de détection de version forçant le re-téléchargement des binaires (yt-dlp, bun) lors d'une mise à jour de l'application pour garantir la stabilité.

## [1.1.52] - 2026-02-19
### Changé
- **Optimisation de la mémoire** : Implémentation d'un système de nettoyage automatique du cache de session Electron toutes les 10 minutes et après chaque téléchargement pour réduire l'empreinte mémoire.

## [1.1.51] - 2026-02-19
### Corrigé
- **Affichage complet de la bibliothèque** : Suppression du filtre excluant l'historique sur la page d'accueil pour que tous les fichiers téléchargés soient visibles.
- **Gestion robuste des métadonnées** : Les vidéos dont le fichier `.info.json` est manquant ne sont plus supprimées de la base de données et du disque, assurant la conservation des fichiers média.
- **Correction de bug DB** : Implémentation de la méthode `removeFile` manquante dans la classe `FileDatabase`.

## [1.1.50] - 2026-02-19
### Ajouté
- **Surveillance du backlog** : Le fichier `backlog.txt` sur le bureau est désormais surveillé. Toute modification externe (ajout ou suppression d'URLs manuelle) est automatiquement détectée et rechargée par l'application sans créer de boucle infinie.

## [1.1.49] - 2026-02-19
### Corrigé
- **ReferenceError: backlogFile is not defined** : Correction de l'erreur de rendu dans les templates EJS en rendant la variable optionnelle et en assurant sa définition dans toutes les configurations possibles de l'application (root et src).

## [1.1.48] - 2026-02-19
### Ajouté
- **Mise à jour automatique et redémarrage** : L'application redémarre désormais automatiquement 3 secondes après avoir fini de télécharger une mise à jour pour l'installer.

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

