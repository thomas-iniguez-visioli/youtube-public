# Gemini CLI - Journal des modifications

## [1.14.51] - 2026-08-23
### Corrigé
- **Silence sur les limites de compression** : Retrait du message d'avertissement de log `logger.warn` lorsque la taille d'un fichier dépasse 2 Go et que la compression ZIP est ainsi ignorée, rendant le traitement silencieux pour ces gros fichiers.

## [1.14.50] - 2026-08-23
### Corrigé
- **Redirection automatique du Splash Screen** : Ajout d'un mécanisme de polling intelligent en JavaScript dans `loading.html`. La page interroge en arrière-plan le port d'Express (`http://localhost:8001/`) et effectue une redirection automatique instantanée dès que le serveur web backend est opérationnel.

## [1.14.49] - 2026-08-23
### Optimisé
- **Vérification non bloquante des miniatures au démarrage** : Déplacement de la routine `downloadMissingThumbnails()` en dehors de la séquence de boot principale d'Electron. Elle est désormais exécutée de manière asynchrone et non bloquante en tâche de fond une fois que le serveur Express a démarré, accélérant considérablement le temps d'apparition de l'interface utilisateur.

## [1.14.48] - 2026-08-23
### Optimisé
- **Lancement instantané de l'interface GUI (Splash Screen)** : Création de la fenêtre Electron immédiatement au démarrage de l'application sans attendre l'initialisation asynchrone des binaires, miniatures et base de données. Ajout d'une page de chargement locale temporaire `loading.html` affichée instantanément, puis redirection automatique vers l'interface Express dès que le serveur est prêt.

## [1.14.47] - 2026-08-21
### Optimisé
- **Vitesse de traitement FFmpeg accrue** : Passage de l'argument `--postprocessor-args "ffmpeg:-preset superfast"` à `yt-dlp` lors de la construction des paramètres de téléchargement. Cela force FFmpeg à utiliser le preset `superfast` de `libx264` lors des étapes de fusion ou de transcodage de formats incompatibles (ex. WebM vers MP4), réduisant drastiquement le temps de post-traitement pour les vidéos volumineuses.

## [1.14.46] - 2026-08-21
### Sécurisé
- **Ignorer les fichiers temporaires de téléchargement** : Exclusion systématique des fichiers partiels et temporaires générés par `yt-dlp` (contenant `.temp`, `.part`, `.ytdl` ou des suffixes de flux séparés comme `.f137.mp4`) lors des rafraîchissements automatiques de la base de données (déclenchés par le watcher de dossiers `fs.watch`) et pendant les scans d'indexation (`readDatabase()` et `readDatabaseAsync()`), évitant les surcharges inutiles et les écritures invalides en base de données.

## [1.14.45] - 2026-08-21
### Changé
- **Indexation asynchrone globale (Résolution des freezes)** : Remplacement de tous les appels restants de `db.readDatabase()` synchrone par la version asynchrone `db.readDatabaseAsync()` (dans le watcher de dossiers, dans le cycle de vie du téléchargement du backlog et lors du changement de répertoire dans l'UI). Cela évite le blocage (freeze) du thread principal d'Electron lors des scans et rafraîchissements de la base de données de vidéos volumineuses.

## [1.14.44] - 2026-08-21
### Corrigé
- **Nettoyage des playlists orphelines/vides** : Suppression automatique des playlists n'ayant plus de vidéos associées lors d'une suppression de vidéo (`removeFile()`), ainsi que le filtrage des ID de vidéos inexistantes et la suppression des playlists devenues vides lors de l'indexation et du scan de la base de données (`readDatabase()` et `readDatabaseAsync()`).

## [1.14.43] - 2026-08-21
### Ajouté
- **Lien de parrainage/sponsors** : Ajout du lien GitHub Sponsors dans la configuration de financement `.github/FUNDING.yml` et ajout d'une section dédiée dans le fichier `README.md` pour permettre aux utilisateurs de soutenir financièrement le projet.

## [1.14.42] - 2026-08-21
### Corrigé
- **Sécurisation du téléchargement de chaînes** : Ajout d'une validation stricte des URLs de chaînes et d'uploaders (vérification du protocole http/https) dans les templates `index.ejs`, `view.ejs` ainsi que dans le contrôleur `download` du backend et le script `renderer.js`. Cela évite l'envoi de chaînes de caractères vides, nulles ou invalides (comme la chaîne `"null"` ou `"undefined"`) à `yt-dlp`, empêchant ainsi les crashs silencieux et les rejets système lors du clic sur le bouton de téléchargement de chaîne.

## [1.14.41] - 2026-08-20
### Ajouté
- **Bouton de recherche manuelle de mise à jour** : Ajout d'un bouton « 🔄 Chercher mise à jour » dans l'onglet Playlists de l'interface client, permettant de déclencher manuellement la recherche de mises à jour via l'API, avec retours visuels sous forme de Toasts descriptifs ("Recherche en cours", "Mise à jour disponible", etc.).
### Changé
- **Logger centralisé** : Migration de la configuration globale d'electron-log vers un module unique `src/logger.js`, importé ensuite par les processus principaux (`index.js`, `db.js`), ce qui évite les duplications et harmonise la structure de logs de l'application.

## [1.14.40] - 2026-08-20
### Ajouté
- **Système de log enrichi** :
  - Passage des logs `electron-log` du niveau `debug` au niveau maximum `silly` pour obtenir toutes les traces possibles en développement et production.
  - Implémentation d'un middleware Express de logging HTTP détaillé, enregistrant chaque méthode, URL, paramètres de requête (`req.query`) et payload (`req.body`) reçus.
  - Migration de toutes les alertes et traces de la base de données (`src/db.js`) vers `electron-log`, fournissant un suivi verbeux complet sur le chargement, la sauvegarde et le scan asynchrone des répertoires de stockage.

## [1.14.39] - 2026-08-20
### Corrigé
- **Gestion propre de l'annulation** : Introduction d'un flag `isDownloadCancelled` sur le processus principal Express. Lors d'une interruption manuelle par le bouton « Couper », la promesse de téléchargement `downloadbacklog` se résout proprement avec `{ cancelled: true }` au lieu de lever un échec de type erreur système, empêchant ainsi les mécanismes d'auto-retry du backlog de réinsérer l'URL ou de retenter le téléchargement en boucle.

## [1.14.38] - 2026-08-20
### Changé
- **Système de mise à jour optimisé** :
  - Ajustement de l'intervalle de vérification automatique de `autoUpdater` de 2 minutes à 1 heure pour éviter le spam réseau et le bannissement par quota d'API GitHub.
  - Implémentation d'événements WebSocket en direct via Socket.io (`update-status`, `update-download-progress`, etc.) pour propager en temps réel l'état des téléchargements et des installations vers l'interface.
  - Ajout de routes API dédiées `POST /updater/check` et `POST /updater/install` permettant de forcer la vérification et l'application manuelle des nouvelles versions.

## [1.14.37] - 2026-08-20
### Changé
- **Barre de progression en haut** : Déplacement du widget de progression de téléchargement (`.download-progress-container`) vers le haut de l'écran (passage de `bottom: 24px` à `top: 24px` dans `style.css`) pour une meilleure visibilité.
### Ajouté
- **Tests d'annulation de téléchargement** : Intégration d'un nouveau test unitaire asynchrone dans `tests/downloader.test.js` qui valide le callback `onProcessCreated` de `runDownload()` et l'arrêt correct d'un processus en cours via un signal d'interruption.

## [1.14.36] - 2026-08-20
### Ajouté
- **Bouton « Couper le téléchargement »** : Implémentation d'une fonctionnalité d'annulation des téléchargements en cours. Ajout d'une route API `POST /download/cancel` terminant proprement le sous-processus `yt-dlp` en cours d'exécution via le signal `SIGKILL`. Intégration d'un bouton interactif « Couper » sur le widget de progression de l'interface utilisateur pour déclencher cette action d'une seule traite.

## [1.14.35] - 2026-08-20
### Sécurisé
- **Résolution des alertes CodeQL restantes (Issues XSS, Path Traversal, SSRF et ReDoS)** :
  - **Reflected XSS** : Échappement des caractères spéciaux avec `escapeHtml` sur la génération de l'avatar SVG dynamique dans `/channel-logo/:uploader` pour empêcher toute injection HTML.
  - **Path Traversal (Path Injection)** : Assainissement strict avec `path.basename` des paramètres d'URL (`id`, `uploader`, `file`) utilisés pour construire des chemins réseau ou des fichiers de cache.
  - **SSRF (Request Forgery)** : Ajout d'une validation regex stricte (`/^[a-zA-Z0-9_\-]{11}$/`) du format de l'ID vidéo YouTube dans `/thumbnail/:id` avant d'émettre des requêtes externes sortantes.
  - **ReDoS (Polynomial Backtracking)** : Remplacement de l'expression régulière de nettoyage de l'ID vidéo à la fin des titres par une regex stricte de longueur fixe sans quantificateur ouvert pour empêcher le backtracking catastrophique.

## [1.14.34] - 2026-08-20
### Sécurisé
- **Résolution de l'alerte CodeQL (Issue #71 - Missing rate limiting)** : Application globale du middleware `express-rate-limit` sur l'ensemble de l'instance d'API Express (`web.use(limiter)`) dans `src/index.js`. Cela protège l'intégralité des routes et l'accès au système de fichiers (notamment les polices, thumbnails, etc.) contre les attaques DoS, éliminant ainsi l'avertissement de sécurité de CodeQL.

## [1.14.33] - 2026-08-20
### Corrigé
- **Résolution du crash de notification au boot (Issue #161)** : Correction de l'envoi de la notification native de démarrage dans `src/index.js`. L'appel attend désormais que l'événement `ready` d'Electron soit déclenché (`app.isReady()`) pour instancier la `Notification`, évitant ainsi le crash `Cannot create Notification before app is ready` au boot de l'application.

## [1.14.32] - 2026-08-20
### Changé
- **Optimisation de la mémoire vive (RAM)** : 
  - Remplacement de l'utilisation de `fs.readFileSync` par `res.sendFile` pour le service des fichiers statiques de l'application et les routes `/thumbnail/:id` et `/channel-logo/:uploader` dans `src/index.js`, ce qui évite de charger l'entièreté des images et scripts en mémoire vive sous forme de Buffers Node.js lors de requêtes massives de la galerie.
  - Purgation active des entrées de suggestions expirées du cache de suggestions (`SuggestionCache`) lors d'un accès par clé dans `src/suggestionCache.js`, évitant l'accumulation en RAM de données de suggestions volumineuses obsolètes.

## [1.14.31] - 2026-08-20
### Corrigé
- **Résolution d'une fuite de mémoire (Memory Leak dans le GC)** : Correction du Garbage Collector de nettoyage des fichiers décompressés (`decompressedFiles`) dans `src/index.js`. L'utilisation d'un bloc `finally` garantit désormais que la clé du fichier est systématiquement supprimée de la Map de cache, même si la suppression physique du fichier `.mp4` sur le disque échoue (fichier verrouillé ou déjà supprimé) ou si le fichier `.zip` correspondant est manquant.

## [1.14.30] - 2026-08-20
### Ajouté
- **Notification native de démarrage (Electron)** : Envoi d'une notification Windows/OS native via l'API `Notification` d'Electron dès le lancement de la séquence de boot asynchrone (`bootApp()`), afin d'informer l'utilisateur que l'initialisation et la préparation de l'application ont commencé.

## [1.14.29] - 2026-08-19
### Changé
- **Bridage dynamique de la taille des fragments (Range Requests)** : Optimisation de la taille maximale des fragments renvoyés par la route `/video`. Si la vidéo est en cours de décompression, la taille des fragments est bridée à 1 Mo maximum. Cela évite que le navigateur ne demande de trop gros morceaux (par ex. 100 Mo) d'un coup, ce qui forçait le serveur à attendre de longs moments de décompression avant de répondre, rendant le chargement de certaines vidéos très long.

## [1.14.28] - 2026-08-19
### Corrigé
- **Superposition des barres de progression** : Suppression du toast de progression Bootstrap redondant (`downloadToastId`) lors du téléchargement d'une vidéo dans `renderer.js` afin d'éviter la superposition de deux barres de chargement à l'écran. Seule la barre globale et animée (`global-download-progress`) est conservée.

## [1.14.27] - 2026-08-19
### Corrigé
- **Résolution du crash appendChild (Issue #160)** : Enveloppement de la création de `progressContainer` dans un écouteur d'événement `DOMContentLoaded` dans `renderer.js`, résolvant l'erreur `Cannot read properties of null (reading 'appendChild')` survenant au démarrage lorsque le body du document n'était pas encore chargé.
- **Ignorer la compression pour les fichiers > 2 Go (Issues #158, #159)** : Ajout d'une limite de taille de 2 Go dans `gzipFile()` dans `src/downloader.js`. Les fichiers vidéo de taille supérieure à 2 Go sont désormais conservés bruts sans tentative de compression ZIP (évitant de dépasser les limites de Buffer de Node.js).

## [1.14.26] - 2026-08-19
### Ajouté
- **Nettoyage automatique des miniatures et logos orphelins (GC)** : Implémentation d'un ramasse-miettes (`cleanupOrphanedThumbnails()`) s'exécutant au démarrage et après la suppression d'une vidéo. Il identifie et supprime les fichiers miniatures (`${yid}.jpg`) et logos de chaînes (`channel_*.jpg`) orphelins (qui ne sont plus liés à aucune vidéo présente dans la base de données), libérant de l'espace disque.

## [1.14.25] - 2026-08-19
### Changé
- **Démarrage d'Electron synchronisé** : Restructuration de la séquence de boot de l'application (`bootApp()`) pour exécuter et attendre la fin de la préparation des répertoires, du téléchargement des binaires (yt-dlp, FFmpeg), de la synchronisation de la base de données et du pré-téléchargement des logos de chaînes/miniatures avant de lancer le serveur HTTP et d'afficher la fenêtre Electron principale.

## [1.14.24] - 2026-08-19
### Ajouté
- **Websocket de logs Frontend -> Backend** : Interception des fonctions `console.log`, `console.warn`, `console.error` et `console.info` du navigateur dans `renderer.js` ainsi que des exceptions JavaScript globales non gérées, et transmission via l'événement WebSocket `front-log` vers le processus Node.js pour un enregistrement unifié dans les logs de l'application.

## [1.14.23] - 2026-08-19
### Changé
- **Streaming instantané des vidéos compressées** : Modification de la route `/video` pour lire la taille globale de la vidéo directement depuis le header du ZIP (instantané), lancer la décompression asynchrone en tâche de fond et servir immédiatement les premiers fragments dès qu'ils sont extraits sur le disque, rendant le lancement de la vidéo instantané sans attendre l'extraction complète.

## [1.14.22] - 2026-08-19
### Changé
- **Optimisation de la décompression ZIP** : Remplacement de la méthode asynchrone `zip.readFile()` d'adm-zip (qui lisait et stockait les fichiers vidéo entiers en mémoire vive sous forme de Buffer géant) par la méthode d'extraction directe par flux `zip.extractEntryTo()`, réduisant considérablement la consommation de mémoire RAM et accélérant le temps de décompression des vidéos temporaires.

## [1.14.21] - 2026-08-19
### Changé
- **Optimisation des performances de scan** : Refactorisation de la méthode d'indexation asynchrone `readDatabaseAsync()` pour exécuter les opérations de stats et de lecture des fichiers `.info.json` en parallèle via un mécanisme de pool à concurrence limitée (30 tâches simultanées max), accélérant considérablement le démarrage de l'application et la réindexation.

## [1.14.20] - 2026-08-19
### Ajouté
- **Logos de chaînes dans la sidebar** : Intégration des logos de chaînes (14px) à côté du nom de l'uploader sur les cartes de suggestions (locales et en ligne) affichées dans la barre latérale de la page de visionnage.

## [1.14.19] - 2026-08-19
### Changé
- **Agrandissement de la taille des icônes de chaînes** : Augmentation de la taille des macarons d'avatars de chaînes pour une meilleure visibilité. Passage de 14px à 24px sur les cartes vidéos de l'accueil, de 18px à 30px sur la page de lecture, et de 24px à 36px pour l'overlay des chaînes suivies.

## [1.14.18] - 2026-08-19
### Corrigé
- **Erreur de syntaxe (route logo)** : Ajout du mot-clé `async` manquant sur la fonction de callback de la route `/channel-logo/:uploader`, résolvant l'erreur de build/démarrage `SyntaxError: Unexpected reserved word` due à l'utilisation de `await` dans un contexte non-async.

## [1.14.17] - 2026-08-19
### Corrigé
- **Gestion des redirections HTTP (302)** : Implémentation d'une gestion récursive robuste des redirections HTTP (301, 302, 307, 308) lors de la récupération des pages de chaînes YouTube, résolvant le problème où les requêtes directes vers les URLs de chaînes renvoyaient des redirections non suivies (causant un repli systématique sur l'avatar par défaut).

## [1.14.16] - 2026-08-19
### Ajouté
- **Bouton de maintenance du cache des logos** : Intégration d'un bouton « 🧹 Purger le cache des icônes » dans l'onglet des Playlists. Il permet de vider instantanément le cache local des logos de chaînes afin de forcer leur retéléchargement en arrière-plan sans bloquer l'interface.

## [1.14.15] - 2026-08-19
### Corrigé
- **Extraction des logos de chaînes** : Amélioration de la logique de récupération de l'image de profil des chaînes pour analyser également l'objet JSON `avatar` présent dans le HTML brut de YouTube (servant de fallback si les balises Open Graph standard manquent) et mise en place d'une purge automatique au démarrage pour remplacer les anciens fallbacks SVG par les vrais logos.

## [1.14.14] - 2026-08-19
### Ajouté
- **Vrais logos de chaînes YouTube** : Remplacement des avatars de lettres par les véritables images de profils (logos) des chaînes YouTube. Implémentation d'une nouvelle route `/channel-logo/:uploader` extrayant dynamiquement l'URL de l'avatar via les métadonnées Open Graph de la page de la chaîne, avec mise en cache locale et fallback SVG élégant.

## [1.14.13] - 2026-08-19
### Changé
- **Redimensionnement des logos de chaînes** : Réduction de la taille des macarons d'avatars de chaînes sur les cartes vidéos (14px) et sur la page de lecture (18px) pour un rendu visuel plus fin, plus compact et mieux intégré à l'interface globale.

## [1.14.12] - 2026-08-19
### Ajouté
- **Avatar d'uploader sur les vidéos** : Intégration d'un petit macaron circulaire avec l'initiale de l'uploader devant son nom sur les cartes de vidéos de l'accueil et sur la page de visionnage pour harmoniser l'identité visuelle de la chaîne.

## [1.14.11] - 2026-08-19
### Ajouté
- **Téléchargement automatique des miniatures** : Implémentation d'une routine en arrière-plan au démarrage et à la fin de chaque téléchargement pour vérifier et télécharger automatiquement les miniatures (`thumbnails`) manquantes afin de garantir leur disponibilité immédiate et hors ligne.

## [1.14.10] - 2026-08-19
### Ajouté
- **Logos de chaînes suivies** : Affichage d'un rendu visuel enrichi pour les chaînes suivies en utilisant le thumbnail de leur première vidéo comme bannière de fond et en ajoutant un macaron de logo circulaire contenant la première lettre de la chaîne pour simuler un avatar.

## [1.14.9] - 2026-08-19
### Changé
- **Séparation dans l'onglet Playlists** : Séparation visuelle claire dans l'onglet Playlists entre vos playlists personnalisées (dossier local/manuelles) et les chaînes suivies (uploaders). Nettoyage de l'affichage des titres de cartes pour masquer les préfixes techniques.

## [1.14.8] - 2026-08-16
### Ajouté
- **Tests unitaires de scan de playlists** : Intégration de tests unitaires asynchrones dans `tests/playlist.test.js` pour valider le scan et l'importation de playlists via `readDatabaseAsync()`.

## [1.14.7] - 2026-08-16
### Corrigé
- **Performances de démarrage et fluidité UI** : Migration de l'archivage et de la décompression ZIP vers un Worker Thread dédié en arrière-plan (`compressWorker.js`). Implémentation d'une indexation asynchrone (`readDatabaseAsync`) et optimisation avec un cache de `mtime` pour éviter les lectures de fichiers `.info.json` redondantes, résolvant les freezes "Ne répond pas" au boot de l'application.

## [1.14.6] - 2026-08-16
### Ajouté
- **Système d'onglets pour les playlists** : Ajout d'un système d'onglets (Vidéos / Playlists) sur la page d'accueil et d'un bouton de raccourci "Playlists" dans les puces de filtres pour basculer facilement entre la bibliothèque de vidéos et la grille de playlists.

## [1.14.5] - 2026-08-16
### Corrigé
- **Nouvelle release** : Nouvelle tentative de publication de la release suite à l'échec de la précédente.

## [1.14.4] - 2026-08-15
### Ajouté
- **Analyse de la vitesse et notifications** : Analyse automatique des lignes de logs de fin de téléchargement pour extraire la vitesse de téléchargement globale, et transmission de cette information dans la notification toast de fin de téléchargement sur l'interface utilisateur.

## [1.14.3] - 2026-08-14
### Changé
- **Journalisation de la mise à jour des métadonnées** : Passage de `log.error` à `log.warn` en cas d'échec de la mise à jour des métadonnées par `yt-dlp`. Cela évite d'émettre de fausses alertes d'erreurs critiques sur le tableau de bord Rollbar pour des événements normaux (vidéo supprimée ou privée sur YouTube).

## [1.14.2] - 2026-08-14
### Ajouté
- **Bouton de purge de l'historique** : Implémentation d'une nouvelle route `/history/clear` et de la méthode de base de données `clearHistory()` permettant de purger complètement l'historique de lecture de l'application via un bouton rouge interactif de confirmation présent sur la vue d'historique.

## [1.14.1] - 2026-08-03
### Changé
- **Scan des fichiers JSON globaux de playlists** : Ajout d'une recherche des fichiers `.info.json` de type `playlist` lors du scan initial de la base de données. Permet de reconstituer les playlists locales dans leur ordre exact d'origine et avec toutes leurs entrées à partir du fichier de métadonnées global généré par `yt-dlp`.

## [1.14.0] - 2026-08-03
### Ajouté
- **Importation et support des playlists YouTube** : Extraction automatique des métadonnées de la playlist d'origine depuis les fichiers `.info.json` des vidéos téléchargées, permettant de créer et d'associer automatiquement les vidéos à une playlist locale correspondante préfixée par `Playlist: `.

## [1.13.10] - 2026-07-19
### Ajouté
- **Test de compilation EJS automatique** : Intégration d'un nouveau test unitaire dans `tests/edge_cases.test.js` qui parcourt et compile automatiquement tous les fichiers templates `.ejs` de l'application afin de détecter proactivement toute erreur de syntaxe ou de token invalide avant le runtime.

## [1.13.9] - 2026-07-19
### Corrigé
- **Résolution de l'erreur de compilation EJS (view.ejs)** : Remplacement des apostrophes échappées par des guillemets doubles dans l'expression de rendu EJS de la variable `nextId` pour éviter les erreurs de syntaxe de compilation.

## [1.13.8] - 2026-07-19
### Ajouté
- **Gestion globale des exceptions (Rollbar)** : Ajout d'écouteurs d'événements Node.js (`uncaughtException` et `unhandledRejection`) dans le Main Process d'Electron pour remonter automatiquement les erreurs globales non capturées de la "zone blanche" sur notre tableau de bord Rollbar.

## [1.13.7] - 2026-07-19
### Ajouté
- **Tests de cas limites (Edge Cases)** : Création d'une nouvelle suite de tests unitaires `tests/edge_cases.test.js` couvrant les erreurs potentielles d'archivage ADM-ZIP (fichiers vides, fichiers inexistants) et les comportements limites de la base de données (indexation vide, extensions non valides).

## [1.13.6] - 2026-07-19
### Corrigé
- **Vidéo suivante obligatoire** : Ajout d'un système de repli (fallback) dans le calcul de la vidéo suivante (route `/watch`) qui, si toutes les autres vidéos sont déjà dans l'historique de lecture, propose quand même la vidéo suivante brute dans le catalogue pour assurer la continuité de la lecture.

## [1.13.5] - 2026-07-19
### Corrigé
- **Protection contre les valeurs nulles (view.ejs)** : Correction d'une erreur EJS `Cannot read properties of null (reading 'id')` sur la route `/watch` qui survenait si la variable de suggestion `nextVideo` renvoyait `null` (ou aucune vidéo disponible).

## [1.13.4] - 2026-07-19
### Corrigé
- **Réparation et restauration de la mise à jour automatique de yt-dlp** : Remplacement de l'argument invalide `-uV` par la bonne option de mise à jour `--update` dans les paramètres de téléchargement. Cela résout le plantage immédiat des téléchargements et permet à `yt-dlp` de se mettre à jour automatiquement de manière fiable.

## [1.13.3] - 2026-07-19
### Corrigé
- **Indexation de la vidéo suivante** : Correction d'un bug dans le calcul de la vidéo suivante suggérée (route `/watch`), qui renvoyait toujours la première vidéo de la liste (index 0) car l'index de la vidéo en cours de lecture était cherché sur la liste déjà filtrée (d'où elle était par conséquent exclue). La recherche de l'index s'effectue désormais sur le catalogue global.

## [1.13.2] - 2026-07-12
### Corrigé
- **Suivi robuste du nettoyeur** : Correction du nettoyeur automatique qui retirait les entrées de la liste de suivi même si le fichier `.mp4` n'avait pas pu être supprimé. Maintenant, l'entrée n'est retirée que si la suppression du fichier ou de l'archive a été effective.

## [1.13.1] - 2026-07-12
### Changé
- **Optimisation du cycle de nettoyage** : Correction de la logique de vérification d'existence du zip avant suppression pour éviter les fuites de fichiers décompressés.

## [1.13.0] - 2026-07-08
### Changé
- **Migration vers ADM-ZIP** : Remplacement de la compression vidéo lente par FFmpeg par une compression d'archivage rapide en `.zip` via `adm-zip`. Suppression du ré-encodage vidéo FFmpeg.

## [1.12.1] - 2026-07-08
### Ajouté
- **Recompression de rattrapage au démarrage** : Intégration d'un processus asynchrone au boot analysant la base de données pour identifier et compresser automatiquement en `.gz` les vidéos `.mp4` physiques n'ayant pas encore été archivées.

## [1.12.0] - 2026-07-08
### Corrigé
- **Compression GZ systématique** : Correction de la détection de fin de téléchargement dans `src/downloader.js` pour capturer également les lignes `Destination:` de `yt-dlp`. Cela garantit que les vidéos n'ayant pas besoin de fusion (téléchargement direct en MP4 standard) déclenchent correctement l'archivage en `.gz` après le téléchargement.

## [1.11.3] - 2026-07-08
### Ajouté
- **Nettoyage au démarrage** : Implémentation d'une routine de nettoyage automatique lors du lancement de l'application, supprimant tous les fichiers `.mp4` décompressés résiduels de la session précédente si leur archive `.mp4.gz` est bien présente sur le stockage.

## [1.11.2] - 2026-07-08
### Corrigé
- **Résolution du problème de hash d'auto-update** : Désactivation du téléchargement différentiel (`disableDifferentialDownload = true`) dans `electron-updater` pour éviter les erreurs de validation de signature blockmap SHA512 sous Windows lors des mises à jour automatiques.

## [1.11.1] - 2026-07-08
### Changé
- **Nettoyage des déclencheurs de Release** : Retrait du trigger redondant `release` de GitHub Actions (`main.yml`) qui causait le saut systématique (*skip*) des builds d'assets lors de la republication.

## [1.11.0] - 2026-07-08
### Ajouté
- **Page des Notes de mise à jour (Patchnotes)** : Intégration d'une nouvelle route `/patchnotes` lisant et convertissant dynamiquement `GEMINI.md` en HTML via un parseur léger. Création d'une vue dédiée `src/views/patchnotes.ejs` respectant la charte esthétique "glassmorphism", et ajout d'un bouton de raccourci "📜 Notes" dans la barre de navigation.

## [1.10.16] - 2026-07-08
### Corrigé
- **Protection des archives GZ** : Ajustement du Garbage Collector pour s'assurer qu'il ne supprime jamais de fichier se terminant par `.gz` dans le dossier de stockage.
- **Suppression complète à la demande** : La route `/delete` supprime désormais le fichier `.mp4` brut ET son archive `.mp4.gz` correspondante lorsqu'elle existe sur le disque, suite à une action explicite de l'utilisateur.

## [1.10.15] - 2026-07-08
### Ajouté
- **Indicateur visuel des vidéos compressées (GZ)** : Intégration du flag `isGz` au scan de la base de données (`src/db.js`) et affichage d'un badge élégant "📦 gz" sur l'interface utilisateur pour indiquer qu'une vidéo est actuellement stockée sous format compressé.

## [1.10.14] - 2026-07-08
### Corrigé
- **Préservation des vidéos non compressées** : Correction de la logique de nettoyage (Garbage Collector) pour supprimer uniquement les fichiers `.mp4` temporaires lorsqu'un fichier `.mp4.gz` correspondant est présent sur le disque. Les fichiers `.mp4` normaux (sans archive `.gz`) ne sont plus supprimés.

## [1.10.13] - 2026-07-08
### Changé
- **Suspension du Garbage Collector pendant la lecture** : Désactivation du nettoyage automatique des fichiers décompressés si une activité de lecture vidéo est détectée (requêtes de fragments actives dans les 30 dernières secondes).

## [1.10.12] - 2026-07-08
### Changé
- **Seuil d'inactivité du Garbage Collector** : Augmentation du délai d'inactivité requis avant la suppression automatique des vidéos temporaires décompressées (`.gz`) de 30 secondes à 5 minutes pour éviter d'interrompre les pauses ou la lecture lente. Fréquence de nettoyage ajustée à 1 minute.

## [1.10.11] - 2026-07-08
### Corrigé
- **Résolution des vidéos existantes (Erreur 404)** : Correction du bug où le changement dynamique de dossier de téléchargement (`config.storagePath`) laissait la variable globale `base` (utilisée pour servir `/video` et supprimer des vidéos) pointée vers l'ancien dossier. Correction également de l'appel erroné `db.scan(newPath)` par le bon enchaînement `db.directoryPath = newPath; db.readDatabase();`.

## [1.10.10] - 2026-07-02
### Corrigé
- **Indexation de la galerie** : Correction de la détection et du nettoyage de la base de données dans `src/db.js` pour accepter et scanner également les fichiers `.mp4.gz` sans les supprimer de la galerie, tout en préservant le format d'enregistrement logique en `.mp4` attendu par le lecteur.

## [1.10.9] - 2026-07-02
### Ajouté
- **Archivage et décompression des vidéos** : Implémentation d'une compression `.gz` (gzip) automatique des vidéos sur le stockage après téléchargement et compression FFmpeg. Ajout de la décompression à la volée temporaire lors de la lecture (/video) et d'un Garbage Collector automatique supprimant les vidéos décompressées inactives après 30 secondes d'inactivité.

## [1.10.8] - 2026-07-02
### Ajouté
- **Cible de packaging** : Ajout de la compression `zip` aux formats de release Windows (NSIS, Portable, ZIP) dans la configuration d'electron-builder de `package.json` pour permettre une version archive de l'application.

## [1.10.7] - 2026-07-02
### Ajouté
- **CI / Auto-update** : Ajout d'une étape d'upload explicite du fichier de configuration d'auto-update Windows (`latest.yml`) dans le workflow GitHub Actions de release afin de garantir sa présence systématique parmi les assets publiés.

## [1.10.6] - 2026-07-02
### Corrigé
- **Dimensions de compression ffmpeg** : Ajout d'un filtre d'échelle limitant la résolution à 720p maximum (`scale=-2:min(720,ih)`) tout en forçant des dimensions paires et le format de pixel compatible `yuv420p` pour éviter les échecs et crashs (erreur Microsoft C++ Exception / AVERROR_EXTERNAL) lors de la compression de vidéos.
- **Test de compression** : Ajout d'un test unitaire validant le rejet correct de la promesse par `compressVideo` si le chemin du binaire ffmpeg est invalide.

## [1.10.5] - 2026-07-02
### Ajouté
- **Compression vidéo automatique** : Compression automatique des vidéos téléchargées (x264 CRF 28 / AAC 128k) avec vérification de gain d'espace pour optimiser le disque.

## [1.10.4] - 2026-07-01
### Ajouté
- **Barre de progression du téléchargement** : Ajout d'une barre de progression globale et animée sur l'interface (pourcentage, vitesse et ETA) lors des téléchargements de vidéos, alimentée par la capture en temps réel de la sortie stdout de `yt-dlp` via Socket.io.

## [1.7.11] - 2026-06-25
### Changé
- **Console de téléchargement** : Augmentation du buffer de la console logs du front de 100 à 1000 lignes pour permettre un historique de téléchargement plus complet.
## [1.10.3] - 2026-06-29
### Changé
- **Report de mise à jour automatique** : Les mises à jour téléchargées ne déclenchent plus le redémarrage et la réinstallation de l'application si l'utilisateur est en cours de lecture d'une vidéo (inactivité détectée sur les requêtes de streaming depuis moins de 30 secondes).

## [1.10.2] - 2026-06-29
### Ajouté
- **Hook Post-push** : Ajout du script `postpush` déclenchant la commande `gh signoff` dans `package.json` et création du hook Git physique `.git/hooks/post-push`.

## [1.10.1] - 2026-06-29
### Corrigé
- **Validation HTTP Range** : Validation des bornes du header `Range` avant le streaming vidéo. Les requêtes avec des bornes mal formées, invalides ou négatives renvoient maintenant un code HTTP `416 Range Not Satisfiable` afin d'éviter les valeurs `NaN` et de sécuriser les appels à `fs.createReadStream`.

## [1.10.0] - 2026-06-29
### Corrigé
- **Streaming & Buffering Initial** : Correction du lag au début de la lecture de certaines vidéos en adaptant la taille du premier fragment à 1 Mo (au lieu de 10 Mo) pour un chargement instantané de l'en-tête et des métadonnées vidéo. Les fragments suivants restent à 10 Mo pour une lecture continue fluide. Prise en compte plus précise des bornes `Range` demandées par le client.

## [1.9.9] - 2026-06-27
### Changé
- **Refactoring Cache & Modularisation** : Refactorisation de `suggestionCache.js` pour utiliser une classe `SuggestionCache` orientée objet. Cela élimine la fonction orpheline `clearCache` (dead export) de la production et permet d'instancier des caches autonomes pour les tests unitaires afin d'isoler leur état.

## [1.9.8] - 2026-06-27
### Corrigé
- **Sécurité & Échappement** : Remplacement de l'attribut inline `onclick` par une liaison dynamique via `addEventListener` dans `createYoutubeSuggestionCard` pour éviter les injections XSS ou les erreurs de syntaxe d'attribut si l'ID renvoyé par l'API contient des guillemets.

## [1.9.7] - 2026-06-27
### Ajouté
- **Stress & Race Condition Tests** : Ajout de tests de robustesse (stress tests) et de vérification d'absence de race condition sur les opérations concurrentes du cache de suggestions.

## [1.9.6] - 2026-06-27
### Ajouté
- **Tests unitaires Cache** : Création d'une suite de tests unitaires dédiés `tests/cache.test.js` pour valider le système de cache de suggestions.
### Changé
- **Modularisation du Cache** : Extraction de la logique du cache dans un module dédié `src/suggestionCache.js` pour une meilleure testabilité et séparation des responsabilités.

## [1.9.5] - 2026-06-27
### Changé
- **Optimisation API Suggestions** : Ajout d'un cache en mémoire de 5 minutes pour les suggestions (`/api/related` et `/api/remixes`) afin de limiter les exécutions de `yt-dlp`.
- **Nettoyage client** : Factorisation du code JavaScript de génération des cartes YouTube et sécurisation HTML (échappement) dans `view.ejs`.

## [1.9.4] - 2026-06-27
### Ajouté
- **Recherche de remixes** : Ajout d'une section "Remixes (YouTube)" dans la vue de visionnage des vidéos (`view.ejs`) qui recherche de manière asynchrone des remixes sur YouTube en se basant sur le titre de la vidéo.
- **Route de remixes** : Ajout d'un endpoint `/api/remixes` dans le serveur Express.

## [1.9.2] - 2026-06-27
### Ajouté
- **File d'attente de masse** : Ajout d'un bouton sur les pages de chaînes pour ajouter instantanément toutes les vidéos de la chaîne à la file d'attente.
- **Route Express** : Ajout de la route POST `/queue/add_multiple` pour traiter l'ajout en lot.

## [1.8.11] - 2026-06-25
### Changé
- **Lecture automatique** : Restauration de la politique d'autoplay sans interaction de l'utilisateur (`no-user-gesture-required`) au niveau d'Electron pour permettre le lancement immédiat des vidéos.
## [1.9.1] - 2026-06-25
### Corrigé
- **Lecture automatique** : Restauration du lancement automatique des vidéos (autoplay) dans Electron en configurant `autoplayPolicy: 'no-user-gesture-required'` dans les préférences web de la fenêtre principale.

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

