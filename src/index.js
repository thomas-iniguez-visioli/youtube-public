import { app, BrowserWindow, ipcMain, dialog, Menu, session } from 'electron';
import binaryResolver from './binaryResolver.js';
import { createRequire } from 'module';
import cors from 'cors';
import express from 'express';
import RateLimit from 'express-rate-limit';
import fs from 'fs';
import https from 'https';
import escapeHtml from 'escape-html';
import path from 'path';
import os from 'os';
import { updateFile } from './updater.js';
import { createDownloadArgs, runDownload, createMetadataArgs } from './downloader.js';
import FileDatabase from './db.js';
import child from 'child_process';
import log from 'electron-log';
import morgan from 'morgan';
import { Server as SocketServer } from 'socket.io';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const rollbarConfig = require('../rollbar.config.cjs');
log.info('Rollbar config loaded:', rollbarConfig ? 'Yes' : 'No');
const Rollbar = require('rollbar');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rollbar = new Rollbar(rollbarConfig);
var booted = false;
const { autoUpdater } = require("electron-updater");

const base = path.join(app.getPath('userData'), 'file');
const db = new FileDatabase(base);

// Deferred sync to avoid blocking startup
setTimeout(() => {
  db.readDatabase();
  db.save();
}, 1000);

const web = express();
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';
log.transports.file.file = path.join(app.getPath('userData'), 'log', 'app.log');

/**
 * Optimisation de la mémoire et nettoyage du cache
 */
const optimizeMemory = async () => {
  try {
    log.info('Optimisation de la mémoire en cours...');
    if (session.defaultSession) {
      await session.defaultSession.clearCache();
      // Only clear cache-related storage to avoid interrupting sessions or video buffering
      await session.defaultSession.clearStorageData({
        storages: ['appcache', 'shadercache', 'cachestorage']
      });
    }
    
    // Trigger garbage collection if exposed
    if (global.gc) {
      global.gc();
      log.info('Garbage collection manuelle effectuée.');
    }

    if (process.platform !== 'darwin') {
      // Sur Windows/Linux, on peut essayer de forcer la réduction du working set
    }
    log.info('Nettoyage du cache terminé.');
  } catch (err) {
    log.error(`Erreur lors de l'optimisation mémoire : ${err.message}`);
  }
};

// Nettoyage périodique toutes les 10 minutes
setInterval(optimizeMemory, 600000);

/**
 * File d'attente pour limiter le nombre de processus yt-dlp simultanés
 */
class DownloadQueue {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.next();
    });
  }

  next() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const { task, resolve, reject } = this.queue.shift();
    this.running++;

    task()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this.running--;
        this.next();
      });
  }
}

const downloadQueue = new DownloadQueue(2);

function setupElectronLogForwarding() {
  // Vérifie que log.hooks existe et est un tableau
  if (!log.hooks || !Array.isArray(log.hooks)) {
    log.warn('electron-log hooks non disponible ou invalide.');
    return;
  }

  // Ajoute un hook pour intercepter les messages de log
  log.hooks.push((message) => {
    // Ne traiter que les erreurs
    if (message.level !== 'error') {
      return message;
    }

    // Extraire l'erreur des données du message
    let errorToReport;
    if (Array.isArray(message.data)) {
      const errorFromData = message.data.find((entry) => entry instanceof Error);
      errorToReport = errorFromData || new Error(message.data.map(String).join(' '));
    } else {
      errorToReport = message.data instanceof Error
        ? message.data
        : new Error(String(message.data || message.text || 'Erreur inconnue dans electron-log'));
    }

    // Envoyer l'erreur à Rollbar avec des métadonnées utiles
    rollbar.error(errorToReport, {
      context: {
        transport: message.transport ? message.transport.name : 'inconnu',
        scope: message.scope || 'default',
        level: message.level,
        // Ajoute d'autres métadonnées pertinentes pour ton projet
        app: 'YouTube Downloader Extension',
        version: pkg.version,
      },
    });

    return message;
  });
}
setupElectronLogForwarding();

const getconfig = () => {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  if (fs.existsSync(configPath)) {
    return require(configPath);
  }
  const defaultConfig = {
    "storagePath": path.join(app.getPath('userData'), 'file'),
    "videoUrlFormat": "https://www.youtube.com/watch?v=${id}",
    "outputFileFormat": "%(channel|)s-%(folder_name|)s-%(title)s [%(id)s].%(ext)s"
  };
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig));
  return defaultConfig;
};
const config = getconfig();

// Surveillance du dossier vidéo pour mise à jour automatique de la DB
const videoFolder = config.storagePath;
let dbWatchTimeout;
if (fs.existsSync(videoFolder)) {
  fs.watch(videoFolder, (eventType, filename) => {
    // On réagit aux changements sur les fichiers .mp4 ou les métadonnées .json
    if (filename && (filename.endsWith('.mp4') || filename.endsWith('.json'))) {
      clearTimeout(dbWatchTimeout);
      dbWatchTimeout = setTimeout(() => {
        log.info(`Modification détectée dans le dossier vidéo : ${filename}. Mise à jour de la base de données...`);
        db.readDatabase();
        db.save();
        // Optionnel : notifier l'UI si nécessaire
        if (typeof io !== 'undefined') {
          io.emit('db-updated');
        }
      }, 5000); // Délai de 5s pour laisser le temps au fichier de se stabiliser (écriture finie)
    }
  });
}

const corsOptions = {
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origine (comme les requêtes locales ou les applications mobiles)
    if (!origin) return callback(null, true);

    // Autoriser les domaines spécifiques, par exemple YouTube
    if (['youtube.com', 'www.youtube.com'].includes(new URL(origin).hostname)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'], // Spécifiez les méthodes HTTP autorisées
  allowedHeaders: ['Content-Type', 'Authorization'], // Spécifiez les en-têtes autorisés
  credentials: true, // Autoriser les cookies et les en-têtes d'authentification
};


// set up rate limiter: high limit for local app to avoid dropping video chunks
const limiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100000, // Increased from 10000 to 100000
});

if (!fs.existsSync(path.join(__dirname))) {
  fs.mkdirSync(path.join(__dirname));
}
if (!fs.existsSync(path.join(app.getPath('userData'), "parsed.txt"))) {
  fs.writeFileSync(path.join(app.getPath('userData'), "parsed.txt"), "");
}

function getRedirectedUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(res.headers.location);
      } else {
        reject(new Error('No redirection found'));
      }
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Move initial autoUpdater check to background or deferred
const initAutoUpdater = () => {
  getRedirectedUrl("https://github.com/thomas-iniguez-visioli/youtube-public/releases/latest").then((url)=>{
    log.info("AutoUpdater Feed URL: " + url.replace("tag","download")+"")
    autoUpdater.setFeedURL(url.replace("tag","download")+"")
    autoUpdater.checkForUpdatesAndNotify();
  }).catch((err)=>{
    log.error("AutoUpdater Init Error: " + err.message)
  })
}

// Consolidate periodic check
setInterval(initAutoUpdater, 120000);
// Run first check deferred
setTimeout(initAutoUpdater, 5000);

function extractUrls(text) {
  const urlRegex = /https?:\/\/(?:[a-zA-Z]|[0-9]|[$_@.&+\-]|[!*\\(),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;
  return text.match(urlRegex) || [];
}
let win;
function sendStatusToWindow(text) {
  log.info(text);
}
autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('Checking for update...');
})
autoUpdater.on('update-available', (info) => {
  sendStatusToWindow('Update available.');
})
autoUpdater.on('update-not-available', (info) => {
  sendStatusToWindow('Update not available.');
})
autoUpdater.on('error', (err) => {
  sendStatusToWindow('Error in auto-updater. ' + err);
  log.error(err);
})
autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
 
  sendStatusToWindow(log_message);
})
autoUpdater.on('update-downloaded', (info) => {
  sendStatusToWindow('Update downloaded. Restarting to install...');
  setTimeout(() => {
    autoUpdater.quitAndInstall();
  }, 3000);
});

let backlogFile = 'backlog.txt';
try {
  backlogFile = path.join(app.getPath('desktop'), 'backlog.txt');
} catch (err) {
  log.error(`Erreur lors de la récupération du chemin desktop : ${err.message}`);
}
const backlog = [];
let isSavingBacklog = false;

const saveBacklog = () => {
  try {
    isSavingBacklog = true;
    fs.writeFileSync(backlogFile, backlog.join('\n'), 'utf8');
    // On laisse un petit délai pour que l'OS traite l'événement de modification
    setTimeout(() => { isSavingBacklog = false; }, 500);
  } catch (err) {
    log.error(`Erreur lors de la sauvegarde du backlog : ${err.message}`);
    isSavingBacklog = false;
  }
};

const loadBacklog = () => {
  try {
    if (fs.existsSync(backlogFile)) {
      const data = fs.readFileSync(backlogFile, 'utf8');
      const lines = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      backlog.length = 0;
      lines.forEach(line => {
        if (!backlog.includes(line)) {
          backlog.push(line);
        }
      });
      log.info(`Backlog rechargé : ${backlog.length} éléments.`);
    }
  } catch (err) {
    log.error(`Erreur lors du chargement du backlog : ${err.message}`);
  }
};

// Surveillance du fichier pour rechargement externe
if (fs.existsSync(backlogFile)) {
  fs.watch(backlogFile, (eventType) => {
    if (eventType === 'change' && !isSavingBacklog) {
      log.info('Modification externe du backlog détectée, rechargement...');
      loadBacklog();
    }
  });
} else {
  // Si le fichier n'existe pas encore, on le crée vide pour pouvoir le surveiller
  try {
    fs.writeFileSync(backlogFile, '', 'utf8');
    fs.watch(backlogFile, (eventType) => {
      if (eventType === 'change' && !isSavingBacklog) {
        log.info('Modification externe du backlog détectée, rechargement...');
        loadBacklog();
      }
    });
  } catch (e) {}
}

loadBacklog();

let isDownloading = false;

const download = (url) => {
  if (!backlog.includes(url)) {
    backlog.push(url);
    saveBacklog();
  }
};

const httpServer = createServer(web);
const io = new SocketServer(httpServer);

// Forward errors to the UI via Socket.io
log.hooks.push((message) => {
  if (message.level === 'error' && io) {
    const text = Array.isArray(message.data) ? message.data.map(String).join(' ') : String(message.data);
    io.emit('error-notification', {
      message: text,
      type: 'error'
    });
  }
  return message;
});

const downloadbacklog = (parameter) => {
  return downloadQueue.add(() => new Promise((resolve, reject) => {
    fs.appendFileSync(path.join(app.getPath('userData'), 'historic.txt'), `${parameter}\n`);
    const logFilePath = path.join(app.getPath('userData'), 'download.log');
    
    const ytdlpPath = binaryResolver.ytdlp;
    const ffmpegDir = binaryResolver.ffmpegDir;
    const denoPath = binaryResolver.deno;

    if (!ytdlpPath) {
      log.error('yt-dlp non trouvé');
      return reject(new Error('yt-dlp non trouvé'));
    }

    const args = createDownloadArgs(parameter, ffmpegDir, config.storagePath, config.outputFileFormat, denoPath);

    const logger = {
      info: (msg) => {
        log.info(msg);
        fs.appendFileSync(logFilePath, `${msg}\n`);
      }
    };

    const notifiedVideos = new Set();

    runDownload(ytdlpPath, args, logger, (filePath) => {
      // Extract video ID from filename like "Title [ID].mp4"
      const match = filePath.match(/\[([^\]]+)\]\.(mp4|mkv|webm|avi)$/);
      if (match) {
        const videoId = match[1];
        if (!notifiedVideos.has(videoId)) {
          notifiedVideos.add(videoId);
          
          // Small delay to let the filesystem/DB catch up
          setTimeout(() => {
            db.readDatabase();
            const video = db.getFile(videoId);
            if (io) {
              io.emit('download-finished', {
                title: video ? video.fileName.replace(` [${video.yid}].mp4`, '').split('-').pop() : 'Vidéo',
                videoId: videoId
              });
            }
          }, 1000);
        }
      }
    })
      .then((res) => {
        db.readDatabase(); // Final refresh
        optimizeMemory();
        resolve(res);
      })
      .catch((err) => {
        optimizeMemory();
        reject(err);
      });
  }));
};

const downloaddata = (parameter) => {
  const ytdlpPath = binaryResolver.ytdlp;
  const ffmpegDir = binaryResolver.ffmpegDir;
  const denoPath = binaryResolver.deno;

  if (!ytdlpPath) return;

  const args = createMetadataArgs(parameter, ffmpegDir, config.storagePath, config.outputFileFormat, denoPath);
  
  runDownload(ytdlpPath, args, { info: (msg) => log.info(`Metadata Update: ${msg}`) })
    .then(() => {
      db.readDatabase();
      db.save();
    })
    .catch(err => log.error(`Erreur mise à jour métadonnées : ${err.message}`));
};

const processBacklog = async () => {
  if (backlog.length > 0 && !isDownloading) {
    isDownloading = true;
    const url = backlog[0];
    try {
      await downloadbacklog(url);
    } catch (err) {
      log.error(`Erreur de téléchargement pour ${url}: ${err.message}`);
    } finally {
      backlog.shift();
      saveBacklog();
      isDownloading = false;
    }
  }
};

setInterval(processBacklog, 5000);

const accessLogStream = fs.createWriteStream(path.join(app.getPath('userData'), "./log/access-" + `${new Date().toDateString()}` + ".log"));
const errorLogStream = fs.createWriteStream(path.join(app.getPath('userData'), "./log/error-" + `${new Date().toDateString()}` + ".log"));
web.use(morgan('combined', { stream: accessLogStream }));
web.use(morgan('combined', { skip: function (req, res) { return res.statusCode < 400 }, stream: errorLogStream }));

// Middleware pour capturer les erreurs Express
web.use((err, req, res, next) => {
  log.error(err);
  next(err);
});

web.use(express.json());
web.use(express.urlencoded({ extended: false }));

web.set('view engine', 'ejs');
web.set('views', path.join(app.getPath('userData'), 'views'));

// Helper: rend index.ejs avec les données communes de la DB en une seule passe
function renderIndex(res, results, channel, channelUrl = null) {
  const historyLimit = Math.floor(db.database.length * 0.8);
  res.render('index', {
    results,
    channel,
    channelUrl,
    playlists: db.getPlaylists(),
    allTags: db.getAllTags(),
    allChannels: db.getAllChannels(),
    historyCount: db.history.length,
    historyLimit: historyLimit > 0 ? historyLimit : db.database.length
  });
}

// Copie un fichier bundle -> userData seulement s'il est absent ou si nouvelle version
function ensureLocalAsset(bundleRelPath, destPath, force = false) {
  if (!force && fs.existsSync(destPath)) return;
  const src = path.join(__dirname, bundleRelPath);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, destPath);
    log.info(`Asset local copié : ${path.basename(destPath)}`);
  }
}

// Vérifie rapidement si internet est accessible (HEAD sur github)
function isOnline() {
  return new Promise((resolve) => {
    const req = https.request({ hostname: 'github.com', method: 'HEAD', path: '/', timeout: 3000 }, () => resolve(true));
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function build() {
  const base = config.storagePath;
  const currentVersion = pkg.version;
  const versionFilePath = path.join(app.getPath('userData'), 'version.txt');
  let lastVersion = '';
  try {
    if (fs.existsSync(versionFilePath)) {
      lastVersion = fs.readFileSync(versionFilePath, 'utf8').trim();
    }
  } catch (e) {}

  const isNewVersion = currentVersion !== lastVersion;
  if (isNewVersion) {
    log.info(`Nouvelle version détectée : ${lastVersion} -> ${currentVersion}. Mise à jour forcée des assets.`);
  }

  // Create necessary directories
  const dirs = [
    path.join(app.getPath('userData'), "src/"),
    path.join(app.getPath('userData'), "src/client-dist"),
    path.join(app.getPath('userData'), 'views'),
    path.join(app.getPath('userData'), 'log'),
    base
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // --- Assets statiques : toujours depuis le bundle en priorité ---
  const assetMap = [
    ['../client-dist/socket.io.js',         'src/client-dist/socket.io.js'],
    ['../client-dist/socket.io.js.map',     'src/client-dist/socket.io.js.map'],
    ['./client-dist/style.css',             'src/client-dist/style.css'],
    ['./client-dist/bootstrap.min.css',     'src/client-dist/bootstrap.min.css'],
    ['./client-dist/bootstrap.bundle.min.js','src/client-dist/bootstrap.bundle.min.js'],
    ['./client-dist/plyr.css',              'src/client-dist/plyr.css'],
    ['./client-dist/plyr.polyfilled.js',    'src/client-dist/plyr.polyfilled.js'],
    ['./client-dist/fuse.js',               'src/client-dist/fuse.js'],
    ['./client-dist/roboto.css',            'src/client-dist/roboto.css'],
    ['./client-dist/favicon.ico',           'src/client-dist/favicon.ico'],
    ['./client-dist/roboto-0.woff2',        'src/client-dist/roboto-0.woff2'],
    ['./client-dist/roboto-1.woff2',        'src/client-dist/roboto-1.woff2'],
    ['./client-dist/roboto-2.woff2',        'src/client-dist/roboto-2.woff2'],
    ['./renderer.js',                       'src/renderer.js'],
    ['./views/index.ejs',                   'views/index.ejs'],
    ['./views/view.ejs',                    'views/view.ejs'],
  ];
  for (const [rel, dest] of assetMap) {
    ensureLocalAsset(rel, path.join(app.getPath('userData'), dest), isNewVersion);
  }

  // --- Binaires : uniquement si connecté ---
  const online = await isOnline();
  if (!online) {
    log.warn('Hors-ligne : téléchargement des binaires ignoré.');
    const validation = await binaryResolver.validateBinaries();
    log.info('Binary validation results (offline):', validation);
    if (isNewVersion) fs.writeFileSync(versionFilePath, currentVersion);
    return;
  }

  const denoBinary = process.platform === 'win32' ? 'deno.exe' : 'deno';
  const denoPath = path.join(app.getPath('userData'), denoBinary);
  const denoUrl = process.platform === 'win32'
    ? 'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip'
    : 'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip';
  const denoZipPath = path.join(app.getPath('userData'), 'deno.zip');

  const ffmpegZipUrl = process.platform === 'win32'
    ? 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'
    : 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz';
  const ffmpegExeName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const ffmpegExePath = path.join(app.getPath('userData'), ffmpegExeName);
  const ffmpegZipPath = path.join(app.getPath('userData'), process.platform === 'win32' ? 'ffmpeg.zip' : 'ffmpeg.tar.xz');
  const ytdlpPath = path.join(app.getPath('userData'), process.platform === 'win32' ? 'ytdlp.exe' : 'ytdlp');

  // Assets distants : seulement si connecté et si nécessaire
  const remoteAssets = [
    { url: 'https://cdn.socket.io/4.4.1/socket.io.js',     dest: path.join(app.getPath('userData'), 'src/client-dist/socket.io.js'),     force: isNewVersion },
    { url: 'https://cdn.socket.io/4.4.1/socket.io.js.map', dest: path.join(app.getPath('userData'), 'src/client-dist/socket.io.js.map'), force: isNewVersion },
  ];

  const downloads = remoteAssets
    .filter(({ dest, force }) => force || !fs.existsSync(dest))
    .map(({ url, dest, force }) => updateFile(url, dest, force));

  if (isNewVersion || !fs.existsSync(ytdlpPath)) {
    downloads.push(updateFile(
      process.platform === 'win32'
        ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
        : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
      ytdlpPath, isNewVersion
    ));
  }
  if (!fs.existsSync(denoPath))    downloads.push(updateFile(denoUrl,      denoZipPath,   false));
  if (!fs.existsSync(ffmpegExePath)) downloads.push(updateFile(ffmpegZipUrl, ffmpegZipPath, false));

  try {
    if (downloads.length > 0) {
      await Promise.allSettled(downloads);
      log.info('Downloads completed');
    }

    // Extraction FFmpeg si nécessaire
    if (fs.existsSync(ffmpegZipPath) && !fs.existsSync(ffmpegExePath)) {
      log.info('Extraction de FFmpeg...');
      const extractDir = path.join(app.getPath('userData'), 'ffmpeg-temp');
      const unzipper = require('unzipper');
      if (process.platform === 'win32') {
        await fs.createReadStream(ffmpegZipPath).pipe(unzipper.Extract({ path: extractDir })).promise();
      } else {
        try { child.execSync(`tar -xf "${ffmpegZipPath}" -C "${app.getPath('userData')}"`); } catch (e) { log.error('Erreur tar Linux:', e); }
      }
      const findBinary = (dir, name) => {
        for (const file of fs.readdirSync(dir)) {
          const full = path.join(dir, file);
          if (fs.statSync(full).isDirectory()) { const f = findBinary(full, name); if (f) return f; }
          else if (file === name) return full;
        }
        return null;
      };
      if (fs.existsSync(extractDir)) {
        for (const name of ['ffmpeg', 'ffprobe', 'ffplay']) {
          const binName = process.platform === 'win32' ? `${name}.exe` : name;
          const src = findBinary(extractDir, binName);
          if (src) {
            const dest = path.join(app.getPath('userData'), binName);
            fs.copyFileSync(src, dest);
            if (process.platform !== 'win32') fs.chmodSync(dest, '755');
          }
        }
        try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch (e) {}
      }
    }

    // Extraction Deno si nécessaire
    if (fs.existsSync(denoZipPath) && !fs.existsSync(denoPath)) {
      log.info('Extraction de Deno...');
      const unzipper = require('unzipper');
      await fs.createReadStream(denoZipPath).pipe(unzipper.Extract({ path: app.getPath('userData') })).promise();
      if (fs.existsSync(denoPath) && process.platform !== 'win32') fs.chmodSync(denoPath, '755');
    }

    if (isNewVersion) fs.writeFileSync(versionFilePath, currentVersion);

    const validation = await binaryResolver.validateBinaries();
    log.info('Binary validation results:', validation);
    if (!validation.ytdlp || !validation.ffmpeg) log.warn('Binaires essentiels manquants (yt-dlp ou ffmpeg).');
    optimizeMemory();
  } catch (error) {
    log.error('Error during build downloads:', error);
  }
}

let promptResponse;
ipcMain.on('prompt', function(eventRet, arg) {
  promptResponse = null
  var promptWindow = new BrowserWindow({
    width: 200,
    height: 100,
    show: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    frame: false
  })
  const promptHtml = `
    <div class="glass-container">
      <label for="val">${arg.title}</label>
      <input id="val" value="${arg.val || ''}" autofocus />
      <div class="actions">
        <button onclick="window.close()">Annuler</button>
        <button class="primary" onclick="require('electron').ipcRenderer.send('prompt-response', document.getElementById('val').value);window.close()">OK</button>
      </div>
    </div>
    <style>
      body { 
        margin: 0; 
        padding: 15px; 
        background: #080808; 
        color: white; 
        font-family: 'Segoe UI', Roboto, sans-serif; 
        overflow: hidden;
      }
      .glass-container {
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 15px;
        height: calc(100vh - 32px);
        display: flex;
        flex-direction: column;
      }
      label { 
        margin-bottom: 8px; 
        font-size: 0.9rem; 
        font-weight: 500; 
        display: block; 
      }
      input { 
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: white;
        padding: 8px 12px;
        margin-bottom: 15px; 
        width: calc(100% - 26px); 
        outline: none;
        transition: border-color 0.2s;
      }
      input:focus { border-color: #3ea6ff; }
      .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: auto; }
      button { 
        padding: 6px 16px; 
        border-radius: 20px; 
        border: 1px solid rgba(255, 255, 255, 0.1); 
        background: rgba(255, 255, 255, 0.05); 
        color: white; 
        cursor: pointer; 
        font-size: 0.85rem;
        transition: all 0.2s;
      }
      button:hover { background: rgba(255, 255, 255, 0.1); }
      button.primary { background: #3ea6ff; border-color: #3ea6ff; font-weight: 600; }
      button.primary:hover { background: #65b8ff; }
    </style>`
  promptWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(promptHtml))
  promptWindow.show()
  promptWindow.on('closed', function() {
    eventRet.returnValue = promptResponse
    download(promptResponse)
    promptWindow = null
  })
})
ipcMain.on('prompt-response', function(event, arg) {
  if (arg === ''){ arg = null }
  promptResponse = arg
  download(promptResponse)
})

log.info('boot now');

web.get("/", function (req, res) {
  const results = [...db.database].sort((a, b) => {
    const dateA = a.mtime || 0;
    const dateB = b.mtime || 0;
    if (dateB !== dateA) return dateB - dateA;
    return (b.score || 0) - (a.score || 0);
  });
  renderIndex(res, results, null);
})
web.get("/queue", function (req, res) {
  renderIndex(res, db.getQueue(), "Ma File d'attente");
});

web.get("/queue/add", function (req, res) {
  const videoId = req.query.id;
  if (videoId) {
    db.addToQueue(videoId);
  }
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    res.json({ success: true, queueCount: db.queue.length });
  } else {
    res.redirect("back");
  }
});

web.get("/queue/remove", function (req, res) {
  const videoId = req.query.id;
  if (videoId) {
    db.removeFromQueue(videoId);
  }
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    res.json({ success: true, queueCount: db.queue.length });
  } else {
    res.redirect("back");
  }
});

web.get("/queue/clear", function (req, res) {
  db.clearQueue();
  res.redirect("/queue");
});

web.get("/watch", function (req, res) {
  const fileData = db.getFile(req.query.id);
  
  if (!fileData || !fileData.fileName) {
    download(config.videoUrlFormat.replace('${id}', req.query.id));
    return res.redirect("/");
  }

  db.addToHistory(req.query.id);

  const infoPath = path.join(config.storagePath, fileData.fileName.replace(".mp4", ".info.json"));
  
  let videodata = {
    title: fileData.fileName,
    uploader: fileData.uploader,
    view_count: fileData.view_count,
    like_count: fileData.like_count,
    comment_count: fileData.comment_count
  };

  if (fs.existsSync(infoPath)) {
    try {
      const onDiskData = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
      videodata = { ...videodata, ...onDiskData };
      if (onDiskData.webpage_url) {
        downloaddata(onDiskData.webpage_url);
      }
    } catch (e) {
      log.error(`Erreur lecture JSON: ${e.message}`);
    }
  }

  const playlistName = req.query.playlist;
  const playlist = playlistName ? db.getPlaylist(playlistName) : null;
  const playlistVideoIds = playlist ? new Set(playlist.videoIds) : new Set();

  const historySet = new Set(db.history);
  // Ne pas retirer la vidéo courante du historySet : elle doit rester filtrée des suggestions
  historySet.add(req.query.id);
  const referencement = [...db.database].sort((a, b) => (b.score || 0) - (a.score || 0));

  const filteredReferencement = referencement.filter(item => {
    // Si la vidéo appartient à la playlist/chaîne en cours de lecture, on l'affiche/suggère pour permettre de la revisionner
    if (playlistVideoIds.has(item.yid)) {
      return true;
    }
    return !historySet.has(item.yid);
  });

  let nextVideo = null;
  const currentInQueue = db.queue.includes(req.query.id);
  const isFavorite = db.isFavorite(req.query.id);

  if (db.queue.length > 0) {
    const queueIdx = db.queue.indexOf(req.query.id);
    if (queueIdx !== -1) {
      if (queueIdx < db.queue.length - 1) {
        nextVideo = db.getFile(db.queue[queueIdx + 1]);
      }
    } else {
      nextVideo = db.getFile(db.queue[0]);
    }
  }

  if (!nextVideo && playlistName) {
    const playlist = db.getPlaylist(playlistName);
    if (playlist) {
      const currentIndex = playlist.videoIds.indexOf(req.query.id);
      if (currentIndex !== -1 && currentIndex < playlist.videoIds.length - 1) {
        nextVideo = db.getFile(playlist.videoIds[currentIndex + 1]);
      }
    }
  }

  if (!nextVideo) {
    const currentIdx = filteredReferencement.findIndex(item => item.yid === req.query.id);
    nextVideo = currentIdx === filteredReferencement.length - 1 ? filteredReferencement[0] : filteredReferencement[currentIdx + 1];
  }

  const historyLimit = Math.floor(db.database.length * 0.8);
  res.render('view', {
    code: req.query.id,
    videos: filteredReferencement,
    title: fileData.fileName,
    videodata: videodata,
    nextVideo: nextVideo,
    playlistName: playlistName,
    currentInQueue: currentInQueue,
    isFavorite: isFavorite,
    playlists: db.getPlaylists(),
    allTags: db.getAllTags(),
    allChannels: db.getAllChannels(),
    historyCount: db.history.length,
    historyLimit: historyLimit > 0 ? historyLimit : db.database.length
  });
});

web.get("/download", function (req, res) {
  let url = req.query.url;
  if (Array.isArray(url)) {
    url = url[0];
  }
  if (typeof url !== 'string' || url.length === 0) {
    return res.status(400).send("Invalid url parameter");
  }
  download(url);
  res.redirect("/")
});

web.post("/tag", function (req, res) {
  const videoId = req.body.videoId;
  const tag = req.body.tag;
  const videoData = db.getFile(videoId);
  if (videoData) {
    if (!videoData.tags.includes(tag)) {
      db.addTag(videoId,tag)
      db.save();
      res.send(`Tag "${escapeHtml(String(tag))}" added to video ${escapeHtml(String(videoId))}`);
    } else {
      res.send(`Tag "${escapeHtml(String(tag))}" already exists for video ${escapeHtml(String(videoId))}`);
    }
  } else {
    res.status(404).send(`Video ${escapeHtml(String(videoId))} not found`);
  }
});


web.get("/delete", function (req, res) {
  const fileData = db.getFile(req.query.id);
  if (!fileData) return res.status(404).send("Video not found");
  const filePath = path.join(base, fileData.fileName);
  if (fs.existsSync(filePath)) fs.rmSync(filePath);
  db.removeFile(req.query.id);
  db.save();
  res.redirect("/");
});

web.get("/api/search", function (req, res) {
  const query = req.query.q || req.query.tags || "";
  const results = db.search(query);
  res.json(results);
});

web.get("/channel", function (req, res) {
  const channelName = req.query.name;
  const results = db.database.filter(item => item.uploader === channelName);
  const channelUrl = results.length > 0 ? results[0].channel_url : null;
  renderIndex(res, results, channelName, channelUrl);
});

web.get("/favorites", function (req, res) {
  renderIndex(res, db.getFavorites(), "Mes Favoris");
});

web.get("/favorite/toggle", function (req, res) {
  const videoId = req.query.id;
  let status = false;
  if (videoId) {
    status = db.toggleFavorite(videoId);
  }
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    res.json({ success: true, isFavorite: status, favoritesCount: db.favorites.length });
  } else {
    res.redirect("back");
  }
});

web.get("/history", function (req, res) {
  renderIndex(res, db.getHistory(), "Historique");
});

web.get("/playlists", function (req, res) {
  renderIndex(res, [], "Mes Playlists");
});

web.get("/playlist", function (req, res) {
  const name = req.query.name;
  const playlist = db.getPlaylist(name);
  if (!playlist) return res.redirect("/playlists");
  renderIndex(res, playlist.videos, `Playlist : ${name}`);
});

web.post("/playlist/create", function (req, res) {
  const name = req.body.name;
  if (name) db.createPlaylist(name);
  res.redirect("/playlists");
});

web.post("/playlist/add", function (req, res) {
  const { playlistName, videoId } = req.body;
  if (playlistName && videoId) {
    db.addVideoToPlaylist(playlistName, videoId);
  }
  res.redirect(`/watch?id=${videoId}`);
});

web.get("/playlist/remove", function (req, res) {
  const { name, videoId } = req.query;
  if (name && videoId) {
    db.removeVideoFromPlaylist(name, videoId);
  }
  res.redirect(`/playlist?name=${encodeURIComponent(name)}`);
});

web.get("/playlist/delete", function (req, res) {
  const name = req.query.name;
  if (name) db.deletePlaylist(name);
  res.redirect("/playlists");
});


function serveStaticFile(req, res, relPath, localRelPath, contentType) {
  if (contentType) res.setHeader("Content-Type", contentType);
  let filePath = path.join(app.getPath('userData'), relPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, localRelPath);
  }
  try {
    res.statusCode = 200;
    res.send(fs.readFileSync(filePath));
  } catch (e) {
    res.status(404).send("File not found");
  }
}

web.get("/style.css", function (req, res) {
  serveStaticFile(req, res, "./src/client-dist/style.css", "./client-dist/style.css", "text/css");
});
web.get("/renderer.js", function (req, res) {
  serveStaticFile(req, res, "./src/renderer.js", "./renderer.js", "application/javascript");
});
web.get("/socket.io.js", function (req, res) {
  serveStaticFile(req, res, "./src/client-dist/socket.io.js", "./client-dist/socket.io.js", "application/javascript");
});
web.get("/socket.io.js.map", function (req, res) {
  serveStaticFile(req, res, "./src/client-dist/socket.io.js.map", "./client-dist/socket.io.js.map", "application/json");
});
web.get("/bootstrap.min.css", function (req, res) {
  serveStaticFile(req, res, "./src/client-dist/bootstrap.min.css", "./client-dist/bootstrap.min.css", "text/css");
});
web.get("/bootstrap.bundle.min.js", function (req, res) {
  serveStaticFile(req, res, "./src/client-dist/bootstrap.bundle.min.js", "./client-dist/bootstrap.bundle.min.js", "application/javascript");
});
web.get("/plyr.css", function (req, res) {
  serveStaticFile(req, res, "./src/client-dist/plyr.css", "./client-dist/plyr.css", "text/css");
});
web.get("/plyr.polyfilled.js", function (req, res) {
  serveStaticFile(req, res, "./src/client-dist/plyr.polyfilled.js", "./client-dist/plyr.polyfilled.js", "application/javascript");
});
web.get("/fuse.js", function (req, res) {
  serveStaticFile(req, res, "./src/client-dist/fuse.js", "./client-dist/fuse.js", "application/javascript");
});
web.get("/roboto.css", function (req, res) {
  serveStaticFile(req, res, "./src/client-dist/roboto.css", "./client-dist/roboto.css", "text/css");
});
web.get("/favicon.ico", function (req, res) {
  serveStaticFile(req, res, "./src/client-dist/favicon.ico", "./client-dist/favicon.ico", "image/x-icon");
});
web.get("/fonts/:file", function (req, res) {
  const file = req.params.file.replace(/[^a-zA-Z0-9._\-]/g, '');
  serveStaticFile(req, res, `./src/client-dist/${file}`, `./client-dist/${file}`, "font/woff2");
});
const thumbCacheDir = path.join(app.getPath('userData'), 'thumbnails');
if (!fs.existsSync(thumbCacheDir)) fs.mkdirSync(thumbCacheDir, { recursive: true });

web.get("/thumbnail/:id", function (req, res) {
  const id = req.params.id.replace(/[^a-zA-Z0-9_\-]/g, '');
  if (!id) return res.status(400).send("Invalid id");
  const cachePath = path.join(thumbCacheDir, `${id}.jpg`);
  if (fs.existsSync(cachePath)) {
    res.setHeader("Content-Type", "image/jpeg");
    return res.send(fs.readFileSync(cachePath));
  }
  const url = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  https.get(url, (stream) => {
    if (stream.statusCode !== 200) return res.status(404).send("Not found");
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => {
      const buf = Buffer.concat(chunks);
      fs.writeFileSync(cachePath, buf);
      res.setHeader("Content-Type", "image/jpeg");
      res.send(buf);
    });
    stream.on('error', () => res.status(500).send("Error"));
  }).on('error', () => res.status(500).send("Error"));
});

web.get("/video", limiter, function (req, res) {
  const range = req.headers.range;
  if (!range) return res.status(400).send("Requires Range header");

  const fileData = db.getFile(req.query.id);
  if (!fileData || !fileData.fileName) return res.status(404).send("Video not found");

  const fileName = path.basename(fileData.fileName); // strip any path components
  const videoPath = path.join(base, fileName);
  if (!videoPath.startsWith(base)) return res.status(400).send("Invalid file path");
  if (!fs.existsSync(videoPath)) return res.status(404).send("File not found on disk");

  const videoSize = fs.statSync(videoPath).size;
  const CHUNK_SIZE = 2 * 10 ** 6; // 2MB
  const start = Number(range.replace(/\D/g, ""));
  const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${videoSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    "Content-Type": "video/mp4",
  });
  fs.createReadStream(videoPath, { start, end }).pipe(res);
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    backgroundColor: '#080808',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });
  
  win = mainWindow;
  ipcMain.on('execute-command', (e, arg) => {
    const parameter = arg;
    log.info(arg);
    var msg = download(parameter);
    return msg;
  });

  ipcMain.handle('select-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      defaultPath: config.storagePath
    });
    if (!canceled && filePaths.length > 0) {
      const newPath = filePaths[0];
      config.storagePath = newPath;
      const configPath = path.join(app.getPath('userData'), 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      db.scan(newPath);
      log.info(`Dossier de téléchargement mis à jour et scan relancé : ${newPath}`);
      return newPath;
    }
    return null;
  });

  mainWindow.loadURL("http://localhost:8001");

  mainWindow.on('closed', () => {
   win = null;
  });
}

// Start the application
httpServer.listen(8001, function () {
  log.info('Listening on port 8001!');
  booted = true;
  if (app.isReady()) {
    createWindow();
  }
  
  // Start background build process after a delay to ensure smooth startup
  setTimeout(() => {
    build().catch(err => log.error('Background build error:', err));
  }, 5000);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && booted) {
    createWindow();
  }
});

app.on('ready', () => {
  if (booted) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
