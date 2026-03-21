let uuid = require("uuid")
const fs = require("fs");
const path = require("path");

const app = require('electron').app;
const userDataPath = app.getPath('userData');
const databaseFilePath = path.join(userDataPath, 'database.json');
const regex = /\[(.*?)\]/;

module.exports =
class FileDatabase {
    constructor(directoryPath) {
        this.directoryPath = directoryPath;
        this.database = [];
        this.history = [];
        this.playlists = [];
        this.queue = [];
        this.favorites = [];
        this.loadDatabase();
        
        // Initial sync
        this.readDatabase();
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
        const tags = new Set();
        this.database.forEach(entry => {
            if (entry.tags) {
                entry.tags.forEach(tag => tags.add(tag));
            }
        });
        return Array.from(tags).sort();
    }

    readDatabase() {
        if (!fs.existsSync(this.directoryPath)) {
            console.warn(`Directory ${this.directoryPath} does not exist, skipping read.`);
            return;
        }

        const files = fs.readdirSync(this.directoryPath);
        const existingFiles = new Map(this.database.map(item => [item.fileName, item]));
        let modified = false;

        files.forEach((item) => {
            if (!item.endsWith(".mp4")) return;

            const existingEntry = existingFiles.get(item);
            const fullPath = path.join(this.directoryPath, item);
            let stats;
            try {
                stats = fs.statSync(fullPath);
            } catch (e) {
                return;
            }

            if (!existingEntry || existingEntry.mtime !== stats.mtimeMs) {
                const idMatch = item.match(regex);
                if (idMatch) {
                    const videoId = idMatch[1];
                    const infoPath = fullPath.replace(".mp4", ".info.json");
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
                                channel_url: info.channel_url || info.uploader_url
                            };
                        } catch (e) {
                            console.error(`Error reading info file ${infoPath}:`, e);
                        }
                    }

                    const newEntry = {
                        fileName: item,
                        fileUuid: `https://www.youtube.com/watch?v=${videoId}`.replace(":", '_'),
                        yid: metadata.display_id,
                        mtime: stats.mtimeMs,
                        tags: existingEntry ? existingEntry.tags : [],
                        uploader: metadata.uploader,
                        view_count: metadata.view_count,
                        like_count: metadata.like_count,
                        comment_count: metadata.comment_count,
                        channel_url: metadata.channel_url,
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
                    
                    modified = true;
                }
            }
        });

        // Cleanup: remove entries for files that no longer exist
        const fileSet = new Set(files);
        const originalLength = this.database.length;
        this.database = this.database.filter(entry => fileSet.has(entry.fileName));
        if (this.database.length !== originalLength) modified = true;

        if (modified) {
            this.saveDatabase();
        }
    }

    saveDatabase() {
        const dir = path.dirname(databaseFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        try {
            fs.writeFileSync(databaseFilePath, JSON.stringify({
                database: this.database,
                history: this.history,
                playlists: this.playlists,
                queue: this.queue,
                favorites: this.favorites
            }));
        } catch (e) {
            console.error("Failed to save database:", e);
        }
    }

    loadDatabase() {
        if (fs.existsSync(databaseFilePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(databaseFilePath));
                this.database = data.database || data;
                this.history = data.history || [];
                this.playlists = data.playlists || [];
                this.queue = data.queue || [];
                this.favorites = data.favorites || [];
            } catch (error) {
                console.error("Failed to parse database file:", error);
                this.database = [];
            }
        }
    }

    getFile(yid) {
        return this.database.find(file => file.yid === yid);
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

    addTag(yid, tag) {
        const file = this.database.find(file => file.yid === yid);
        if (file) {
            if (!file.tags) file.tags = [];
            if (!file.tags.includes(tag)) {
                file.tags.push(tag);
                this.saveDatabase();
            }
        }
    }

    removeTag(yid, tag) {
        const file = this.database.find(file => file.yid === yid);
        if (file && file.tags) {
            file.tags = file.tags.filter(t => t !== tag);
            this.saveDatabase();
        }
    }

    removeFile(yid) {
        this.database = this.database.filter(file => file.yid !== yid);
        this.history = this.history.filter(id => id !== yid);
        this.queue = this.queue.filter(id => id !== yid);
        this.favorites = this.favorites.filter(id => id !== yid);
        this.playlists.forEach(p => {
            p.videoIds = p.videoIds.filter(id => id !== yid);
        });
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

    addToQueue(videoId) {
        if (!this.queue.includes(videoId)) {
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

