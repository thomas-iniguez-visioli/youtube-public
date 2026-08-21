import fs from "fs";
import path from "path";
import { createRequire } from 'module';
import log from './logger.js';

const require = createRequire(import.meta.url);

let app;
try {
    app = require('electron').app;
} catch (e) {
    // Not in Electron
}

const userDataPath = app ? app.getPath('userData') : process.cwd();
const databaseFilePath = path.join(userDataPath, 'database.json');
const regex = /\[([^\]]+)\]\.mp4$/;

export default class FileDatabase {
    constructor(directoryPath) {
        this.directoryPath = directoryPath;
        this.database = [];
        this.history = [];
        this.playlists = [];
        this.queue = [];
        this.favorites = [];
        this.yidMap = new Map();
        this._playlistFileMtimes = {};
        this.loadDatabase();
    }

    _buildIndex() {
        this.yidMap.clear();
        this._tagsCache = null;
        this._channelsCache = null;
        if (Array.isArray(this.database)) {
            this.database.forEach(file => {
                if (file && file.yid) {
                    this.yidMap.set(file.yid, file);
                }
            });
        }
    }

    search(query) {
       const q = query.toLowerCase();
       return this.database.filter((entry) => {
         return entry.fileName.toLowerCase().includes(q) || 
                (entry.tags && entry.tags.some(tag => tag.toLowerCase().includes(q))) ||
                (entry.uploader && entry.uploader.toLowerCase().includes(q));
       });
     }

    getAllTags() {
        if (this._tagsCache) return this._tagsCache;
        const tags = new Set();
        this.database.forEach(entry => {
            if (entry.tags) entry.tags.forEach(tag => tags.add(tag));
        });
        this._tagsCache = Array.from(tags).sort();
        return this._tagsCache;
    }

    getAllChannels() {
        if (this._channelsCache) return this._channelsCache;
        const channels = new Set();
        this.database.forEach(entry => {
            if (entry.uploader && entry.uploader !== 'Uploader inconnu') {
                channels.add(entry.uploader);
            }
        });
        this._channelsCache = Array.from(channels).sort();
        return this._channelsCache;
    }

    readDatabase() {
        if (!fs.existsSync(this.directoryPath)) {
            log.warn(`[DB] Le répertoire ${this.directoryPath} n'existe pas, lecture ignorée.`);
            return;
        }

        const files = fs.readdirSync(this.directoryPath);
        const existingFiles = new Map(this.database.map(item => [item.fileName, item]));
        let modified = false;

        files.forEach((item) => {
            const isGz = item.endsWith(".mp4.zip");
            if (!item.endsWith(".mp4") && !isGz) return;

            const baseFileName = isGz ? item.slice(0, -4) : item;
            const existingEntry = existingFiles.get(baseFileName);
            const fullPath = path.join(this.directoryPath, item);
            let stats;
            try {
                stats = fs.statSync(fullPath);
            } catch (e) {
                return;
            }

            if (existingEntry) {
                if (existingEntry.isGz !== isGz) {
                    existingEntry.isGz = isGz;
                    modified = true;
                }
            }

            if (!existingEntry || existingEntry.mtime !== stats.mtimeMs || existingEntry.fileUuid.includes(' ') || (existingEntry.yid && !existingEntry.fileUuid.includes(existingEntry.yid))) {
                const idMatch = baseFileName.match(regex);
                if (idMatch) {
                    const videoId = idMatch[1];
                    const infoPath = path.join(this.directoryPath, baseFileName.replace(".mp4", ".info.json"));
                    let metadata = {
                        uploader: 'Uploader inconnu',
                        view_count: 0,
                        like_count: 0,
                        comment_count: 0,
                        display_id: videoId
                    };

                    if (fs.existsSync(infoPath)) {
                        try {
                            const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                            metadata = {
                                uploader: info.uploader || 'Uploader inconnu',
                                view_count: info.view_count || 0,
                                like_count: info.like_count || 0,
                                comment_count: info.comment_count || 0,
                                display_id: info.display_id || videoId,
                                channel_url: info.channel_url || info.uploader_url,
                                playlist_title: info.playlist_title || info.playlist || null
                            };
                        } catch (e) {
                            console.error(`Error reading info file ${infoPath}:`, e);
                        }
                    }

                    const newEntry = {
                        fileName: baseFileName,
                        fileUuid: `https://www.youtube.com/watch?v=${videoId}`.replace(":", '_'),
                        yid: metadata.display_id,
                        mtime: stats.mtimeMs,
                        isGz: isGz,
                        tags: existingEntry ? existingEntry.tags : [],
                        uploader: metadata.uploader,
                        view_count: metadata.view_count,
                        like_count: metadata.like_count,
                        comment_count: metadata.comment_count,
                        channel_url: metadata.channel_url,
                        playlist_title: metadata.playlist_title,
                        score: (metadata.view_count * 0.5) + (metadata.like_count * 0.3) + (metadata.comment_count * 0.2)
                    };

                    if (existingEntry) {
                        Object.assign(existingEntry, newEntry);
                    } else {
                        this.database.push(newEntry);
                    }
                    
                    // Auto-ensure playlist for channel
                    if (metadata.uploader !== 'Uploader inconnu') {
                        this.ensureChannelPlaylist(metadata.display_id, metadata.uploader);
                    }

                    // Auto-ensure downloaded YouTube playlist
                    if (metadata.playlist_title) {
                        this.ensureYoutubePlaylist(metadata.display_id, metadata.playlist_title);
                    }
                    
                    modified = true;
                }
            }
        });

        // Scanner également les fichiers JSON de métadonnées de playlists
        files.forEach((item) => {
            if (item.endsWith(".info.json")) {
                const fullPath = path.join(this.directoryPath, item);
                try {
                    const stats = fs.statSync(fullPath);
                    const lastMtime = this._playlistFileMtimes[item];
                    if (lastMtime === stats.mtimeMs) {
                        return;
                    }
                    
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const info = JSON.parse(content);
                    if (info && info._type === 'playlist' && info.title) {
                        const playlistName = `Playlist: ${info.title}`;
                        this.createPlaylist(playlistName);
                        
                        if (Array.isArray(info.entries)) {
                            info.entries.forEach(entry => {
                                if (entry && entry.id) {
                                    this.addVideoToPlaylist(playlistName, entry.id);
                                }
                            });
                        }
                        this._playlistFileMtimes[item] = stats.mtimeMs;
                        modified = true;
                    }
                } catch (e) {
                    // Ignorer
                }
            }
        });

        // Cleanup: remove entries for files that no longer exist (either as .mp4 or .mp4.zip)
        const fileSet = new Set(files);
        const originalLength = this.database.length;
        this.database = this.database.filter(entry => fileSet.has(entry.fileName) || fileSet.has(entry.fileName + '.zip'));
        if (this.database.length !== originalLength) modified = true;

        // Cleanup empty playlists and deleted videos from playlists
        const activeYids = new Set(this.database.map(v => v.yid));
        const originalPlaylistsLength = this.playlists.length;
        this.playlists.forEach(p => {
            p.videoIds = p.videoIds.filter(id => activeYids.has(id));
        });
        this.playlists = this.playlists.filter(p => p.videoIds.length > 0);
        if (this.playlists.length !== originalPlaylistsLength) modified = true;

        if (modified) {
            this._buildIndex();
            this.saveDatabase();
        }
    }

    async readDatabaseAsync() {
        if (!fs.existsSync(this.directoryPath)) {
            log.warn(`[DB] Le répertoire ${this.directoryPath} n'existe pas, lecture asynchrone ignorée.`);
            return;
        }

        const files = await fs.promises.readdir(this.directoryPath);
        const existingFiles = new Map(this.database.map(item => [item.fileName, item]));
        let modified = false;

        // Filtrer les fichiers pertinents (.mp4 et .mp4.zip)
        const relevantFiles = files.filter(item => {
            const isGz = item.endsWith(".mp4.zip");
            return item.endsWith(".mp4") || isGz;
        });

        // Limiter la concurrence pour éviter d'ouvrir trop de fichiers simultanément
        const limitConcur = async (items, limit, fn) => {
            const results = [];
            const executing = [];
            for (const item of items) {
                const p = Promise.resolve().then(() => fn(item));
                results.push(p);
                if (limit <= items.length) {
                    const e = p.then(() => executing.splice(executing.indexOf(e), 1));
                    executing.push(e);
                    if (executing.length >= limit) {
                        await Promise.race(executing);
                    }
                }
            }
            return Promise.all(results);
        };

        const processVideoFile = async (item) => {
            const isGz = item.endsWith(".mp4.zip");
            const baseFileName = isGz ? item.slice(0, -4) : item;
            const existingEntry = existingFiles.get(baseFileName);
            const fullPath = path.join(this.directoryPath, item);
            let stats;
            try {
                stats = await fs.promises.stat(fullPath);
            } catch (e) {
                return;
            }

            let entryModified = false;
            if (existingEntry) {
                if (existingEntry.isGz !== isGz) {
                    existingEntry.isGz = isGz;
                    entryModified = true;
                }
            }

            if (!existingEntry || existingEntry.mtime !== stats.mtimeMs || existingEntry.fileUuid.includes(' ') || (existingEntry.yid && !existingEntry.fileUuid.includes(existingEntry.yid))) {
                const idMatch = baseFileName.match(regex);
                if (idMatch) {
                    const videoId = idMatch[1];
                    const infoPath = path.join(this.directoryPath, baseFileName.replace(".mp4", ".info.json"));
                    let metadata = {
                        uploader: 'Uploader inconnu',
                        view_count: 0,
                        like_count: 0,
                        comment_count: 0,
                        display_id: videoId
                    };

                    try {
                        if (fs.existsSync(infoPath)) {
                            const content = await fs.promises.readFile(infoPath, 'utf8');
                            const info = JSON.parse(content);
                            metadata = {
                                uploader: info.uploader || 'Uploader inconnu',
                                view_count: info.view_count || 0,
                                like_count: info.like_count || 0,
                                comment_count: info.comment_count || 0,
                                display_id: info.display_id || videoId,
                                channel_url: info.channel_url || info.uploader_url,
                                playlist_title: info.playlist_title || info.playlist || null
                            };
                        }
                    } catch (e) {
                        log.error(`[DB] Erreur lors de la lecture du fichier info JSON ${infoPath} : ${e.message}`, e);
                    }

                    const newEntry = {
                        fileName: baseFileName,
                        fileUuid: `https://www.youtube.com/watch?v=${videoId}`.replace(":", '_'),
                        yid: metadata.display_id,
                        mtime: stats.mtimeMs,
                        isGz: isGz,
                        tags: existingEntry ? existingEntry.tags : [],
                        uploader: metadata.uploader,
                        view_count: metadata.view_count,
                        like_count: metadata.like_count,
                        comment_count: metadata.comment_count,
                        channel_url: metadata.channel_url,
                        playlist_title: metadata.playlist_title,
                        score: (metadata.view_count * 0.5) + (metadata.like_count * 0.3) + (metadata.comment_count * 0.2)
                    };

                    if (existingEntry) {
                        Object.assign(existingEntry, newEntry);
                    } else {
                        this.database.push(newEntry);
                    }

                    if (metadata.uploader !== 'Uploader inconnu') {
                        this.ensureChannelPlaylist(metadata.display_id, metadata.uploader);
                    }

                    if (metadata.playlist_title) {
                        this.ensureYoutubePlaylist(metadata.display_id, metadata.playlist_title);
                    }

                    modified = true;
                }
            } else if (entryModified) {
                modified = true;
            }
        };

        await limitConcur(relevantFiles, 30, processVideoFile);

        // Scanner également les fichiers JSON de métadonnées de playlists
        const infoFiles = files.filter(item => item.endsWith(".info.json"));
        const processInfoFile = async (item) => {
            const fullPath = path.join(this.directoryPath, item);
            try {
                const stats = await fs.promises.stat(fullPath);
                const lastMtime = this._playlistFileMtimes[item];
                if (lastMtime === stats.mtimeMs) {
                    return;
                }

                const content = await fs.promises.readFile(fullPath, 'utf8');
                const info = JSON.parse(content);
                if (info && info._type === 'playlist' && info.title) {
                    const playlistName = `Playlist: ${info.title}`;
                    this.createPlaylist(playlistName);

                    if (Array.isArray(info.entries)) {
                        info.entries.forEach(entry => {
                            if (entry && entry.id) {
                                this.addVideoToPlaylist(playlistName, entry.id);
                            }
                        });
                    }
                    this._playlistFileMtimes[item] = stats.mtimeMs;
                    modified = true;
                }
            } catch (e) {
                // Ignore
            }
        };

        await limitConcur(infoFiles, 30, processInfoFile);

        const fileSet = new Set(files);
        const originalLength = this.database.length;
        this.database = this.database.filter(entry => fileSet.has(entry.fileName) || fileSet.has(entry.fileName + '.zip'));
        if (this.database.length !== originalLength) modified = true;

        // Cleanup empty playlists and deleted videos from playlists
        const activeYids = new Set(this.database.map(v => v.yid));
        const originalPlaylistsLength = this.playlists.length;
        this.playlists.forEach(p => {
            p.videoIds = p.videoIds.filter(id => activeYids.has(id));
        });
        this.playlists = this.playlists.filter(p => p.videoIds.length > 0);
        if (this.playlists.length !== originalPlaylistsLength) modified = true;

        if (modified) {
            this._buildIndex();
            this.saveDatabase();
        }
    }

    save() {
        this.saveDatabase();
    }

    saveDatabase() {
        const dir = path.dirname(databaseFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        try {
            log.info(`[DB] Sauvegarde de la base de données (${this.database.length} vidéos, ${this.playlists.length} playlists, ${this.history.length} historiques, ${this.queue.length} en file d'attente)`);
            fs.writeFileSync(databaseFilePath, JSON.stringify({
                database: this.database,
                history: this.history,
                playlists: this.playlists,
                queue: this.queue,
                favorites: this.favorites
            }));
            log.debug("[DB] Sauvegarde réussie dans " + databaseFilePath);
        } catch (e) {
            log.error(`[DB] Échec de la sauvegarde de la base de données: ${e.message}`, e);
        }
    }

    loadDatabase() {
        log.info("[DB] Chargement de la base de données depuis " + databaseFilePath);
        if (fs.existsSync(databaseFilePath)) {
            try {
                const content = fs.readFileSync(databaseFilePath, 'utf8');
                if (!content) {
                    this.database = [];
                    log.warn("[DB] Le fichier de base de données est vide.");
                    return;
                }
                const data = JSON.parse(content);
                this.database = Array.isArray(data.database) ? data.database : (Array.isArray(data) ? data : []);
                this.history = Array.isArray(data.history) ? data.history : [];
                this.playlists = Array.isArray(data.playlists) ? data.playlists : [];
                this.queue = Array.isArray(data.queue) ? data.queue : [];
                this.favorites = Array.isArray(data.favorites) ? data.favorites : [];
                log.info(`[DB] Base de données chargée avec succès. Entrées indexées : ${this.database.length} vidéos, ${this.playlists.length} playlists.`);
            } catch (error) {
                log.error(`[DB] Échec de la lecture de la base de données: ${error.message}`, error);
                this.database = [];
                this.history = [];
                this.playlists = [];
                this.queue = [];
                this.favorites = [];
            }
        } else {
            log.warn("[DB] Aucun fichier de base de données existant trouvé. Initialisation à vide.");
        }
        this._buildIndex();
    }

    getFile(yid) {
        return this.yidMap.get(yid) ?? null;
    }

    toggleFavorite(videoId) {
        const index = this.favorites.indexOf(videoId);
        if (index > -1) {
            this.favorites.splice(index, 1);
        } else {
            this.favorites.push(videoId);
        }
        this.saveDatabase();
        return this.favorites.includes(videoId);
    }

    isFavorite(videoId) {
        return this.favorites.includes(videoId);
    }

    getFavorites() {
        return this.favorites.map(id => this.getFile(id)).filter(file => !!file);
    }

    createPlaylist(name) {
        if (!this.playlists.find(p => p.name === name)) {
            this.playlists.push({ name: name, videoIds: [] });
            this.saveDatabase();
            return true;
        }
        return false;
    }

    deletePlaylist(name) {
        this.playlists = this.playlists.filter(p => p.name !== name);
        this.saveDatabase();
    }

    addVideoToPlaylist(playlistName, videoId) {
        const playlist = this.playlists.find(p => p.name === playlistName);
        if (playlist && !playlist.videoIds.includes(videoId)) {
            playlist.videoIds.push(videoId);
            this.saveDatabase();
            return true;
        }
        return false;
    }

    removeVideoFromPlaylist(playlistName, videoId) {
        const playlist = this.playlists.find(p => p.name === playlistName);
        if (playlist) {
            playlist.videoIds = playlist.videoIds.filter(id => id !== videoId);
            this.saveDatabase();
        }
    }

    getPlaylists() {
        return this.playlists;
    }

    getPlaylist(name) {
        const playlist = this.playlists.find(p => p.name === name);
        if (playlist) {
            return {
                ...playlist,
                videos: playlist.videoIds.map(id => this.getFile(id)).filter(file => !!file)
            };
        }
        return null;
    }

    ensureChannelPlaylist(videoId, channelName) {
        if (!channelName || channelName === 'Uploader inconnu') return;
        const playlistName = `Channel: ${channelName}`;
        this.createPlaylist(playlistName);
        this.addVideoToPlaylist(playlistName, videoId);
    }

    ensureYoutubePlaylist(videoId, playlistTitle) {
        if (!playlistTitle) return;
        const playlistName = `Playlist: ${playlistTitle}`;
        this.createPlaylist(playlistName);
        this.addVideoToPlaylist(playlistName, videoId);
    }

    addTag(yid, tag) {
        const file = this.database.find(file => file.yid === yid);
        if (file) {
            if (!file.tags) file.tags = [];
            if (!file.tags.includes(tag)) {
                file.tags.push(tag);
                this._tagsCache = null;
                this.saveDatabase();
            }
        }
    }

    removeTag(yid, tag) {
        const file = this.database.find(file => file.yid === yid);
        if (file && file.tags) {
            file.tags = file.tags.filter(t => t !== tag);
            this._tagsCache = null;
            this.saveDatabase();
        }
    }

    removeFile(yid) {
        this.database = this.database.filter(file => file.yid !== yid);
        if (this.yidMap) this.yidMap.delete(yid);
        this._tagsCache = null;
        this._channelsCache = null;
        this.history = this.history.filter(id => id !== yid);
        this.queue = this.queue.filter(id => id !== yid);
        this.favorites = this.favorites.filter(id => id !== yid);
        this.playlists.forEach(p => {
            p.videoIds = p.videoIds.filter(id => id !== yid);
        });
        this.playlists = this.playlists.filter(p => p.videoIds.length > 0);
        this.saveDatabase();
    }

    addToHistory(videoId) {
        this.history = this.history.filter(id => id !== videoId);
        this.history.unshift(videoId);
        const limit = Math.floor(this.database.length * 0.8);
        if (this.history.length > limit && limit > 0) {
            this.history.pop();
        }
        this.saveDatabase();
    }

    getHistory() {
        return this.history.map(id => this.getFile(id)).filter(file => !!file);
    }

    clearHistory() {
        this.history = [];
        this.saveDatabase();
    }

    addToQueue(videoId) {
        if (videoId && typeof videoId === 'string' && this.getFile(videoId) && !this.queue.includes(videoId)) {
            this.queue.push(videoId);
            this.saveDatabase();
            return true;
        }
        return false;
    }

    removeFromQueue(videoId) {
        this.queue = this.queue.filter(id => id !== videoId);
        this.saveDatabase();
    }

    getQueue() {
        return this.queue.map(id => this.getFile(id)).filter(file => !!file);
    }

    clearQueue() {
        this.queue = [];
        this.saveDatabase();
    }
}
