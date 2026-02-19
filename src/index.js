const { app, BrowserWindow, ipcMain, dialog, Menu, session } = require('electron');
const rollbarConfig = require('../rollbar.config.js');
const Rollbar = require('rollbar');
const rollbar = new Rollbar(rollbarConfig);
const e=require("electron")
const cors =require("cors")
var booted=false
const {autoUpdater}=require("electron-updater")//require("./autoupdate")
const express = require('express');
const RateLimit = require('express-rate-limit');
const fs = require('fs');const https = require('https');
const path = require('path');
const { updateFile } = require('./updater');
const { createDownloadArgs, runDownload, createMetadataArgs } = require('./downloader');

const child = require('child_process');
const log = require('electron-log');
log.transports.file.level = 'info';
log.transports.console.level = 'info';
log.transports.file.file = path.join(app.getPath('userData'), 'log', 'app.log');

/**
 * Optimisation de la mémoire et nettoyage du cache
 */
const optimizeMemory = async () => {
  try {
    log.info('Optimisation de la mémoire en cours...');
    if (session.defaultSession) {
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData({
        storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
      });
    }
    if (process.platform !== 'darwin') {
      // Sur Windows/Linux, on peut essayer de forcer la réduction du working set
      // bien que Node/V8 gère cela, Electron a parfois des fuites dans le processus de rendu
    }
    log.info('Nettoyage du cache terminé.');
  } catch (err) {
    log.error(`Erreur lors de l'optimisation mémoire : ${err.message}`);
  }
};

// Nettoyage périodique toutes les 10 minutes
setInterval(optimizeMemory, 600000);

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
        version: require('../package.json').version,
      },
    });

    return message;
  });
}
setupElectronLogForwarding()
const getconfig=()=>{
  if(fs.existsSync(path.join(app.getPath('userData'), 'config.json'))){
    return require(path.join(app.getPath('userData'), 'config.json'));
  }
  fs.writeFileSync(path.join(app.getPath('userData'), 'config.json'), JSON.stringify({
    "storagePath": path.join(app.getPath('userData'), 'file'),
    "videoUrlFormat": "https://www.youtube.com/watch?v=${id}",
    "outputFileFormat": "%(channel|)s-%(folder_name|)s-%(title)s [%(id)s].%(ext)s"
  }))
  return require(path.join(app.getPath('userData'), 'config.json'))
}
const config = getconfig();
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


// set up rate limiter: maximum of 100 requests per 15 minutes
const limiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // max 100 requests per windowMs
});

  

if (!fs.existsSync(path.join(__dirname))) { // Correction pour utiliser path.join pour une construction de chemin valide
  fs.mkdirSync(path.join(__dirname)) // Correction pour utiliser path.join pour une construction de chemin valide
}
if (!fs.existsSync(path.join(app.getPath('userData'), "parsed.txt"))) { // Correction pour utiliser path.join pour une construction de chemin valide
  fs.writeFileSync(path.join(app.getPath('userData'), "parsed.txt"), "") // Correction pour utiliser path.join pour une construction de chemin valide
}
//autoUpdater.allowDowngrade=true
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
getRedirectedUrl("https://github.com/thomas-iniguez-visioli/youtube-public/releases/latest").then((url)=>{
 log.info(url.replace("tag","download")+"/latest.yml")
  autoUpdater.setFeedURL(url.replace("tag","download")+"")
  autoUpdater.checkForUpdatesAndNotify();
}).catch((err)=>{
  log.error(err)
 
})
setInterval(() => {
  // Code à exécuter toutes les 2 minutes
  getRedirectedUrl("https://github.com/thomas-iniguez-visioli/youtube-public/releases/latest").then((url)=>{
  //  log.info(url.replace("tag","download")+"/latest.yml")
    autoUpdater.setFeedURL(url.replace("tag","download")+"")
    autoUpdater.checkForUpdatesAndNotify();
  }).catch((err)=>{
    log.error(err)
   
  })
}, 120000);




//log.info(autoUpdater)
function extractUrls(text) {
  const urlRegex = /https?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;
  return text.match(urlRegex) || [];
}
let win;
function sendStatusToWindow(text) {
  log.info(text);
  //win.webContents.send('message', text);
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
      
      // On remplace le contenu du backlog par celui du fichier, 
      // tout en préservant l'ordre.
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

setInterval(processBacklog, 1000);

const downloadbacklog = (parameter) => {
  return new Promise((resolve, reject) => {
    fs.appendFileSync(path.join(app.getPath('userData'), 'historic.txt'), `${parameter}\n`);
    const logFilePath = path.join(app.getPath('userData'), 'download.log');
    
    const ytdlpPath = process.platform === 'win32' ? path.join(app.getPath('userData'), 'ytdlp.exe') : path.join(app.getPath('userData'), 'ytdlp');
    const ffmpegDir = path.join(app.getPath('userData'), 'ffmpeg', 'ffmpeg-master-latest-win64-gpl', 'bin');
    const bunPath = process.platform === 'win32' ? path.join(app.getPath('userData'), 'bun.exe') : path.join(app.getPath('userData'), 'bun');

    const args = createDownloadArgs(parameter, ffmpegDir, config.storagePath, config.outputFileFormat, bunPath);

    const logger = {
      info: (msg) => {
        log.info(msg);
        fs.appendFileSync(logFilePath, `${msg}\n`);
      }
    };

    runDownload(ytdlpPath, args, logger)
      .then((res) => {
        optimizeMemory();
        resolve(res);
      })
      .catch((err) => {
        optimizeMemory();
        reject(err);
      });
  });
};

const downloaddata = (parameter) => {
  const ytdlpPath = process.platform === 'win32' ? path.join(app.getPath('userData'), 'ytdlp.exe') : path.join(app.getPath('userData'), 'ytdlp');
  
  if (!fs.existsSync(ytdlpPath)) {
    log.error(`yt-dlp non trouvé : ${ytdlpPath}`);
    return;
  }

  const bunPath = process.platform === 'win32' ? path.join(app.getPath('userData'), 'bun.exe') : path.join(app.getPath('userData'), 'bun');
  const args = createMetadataArgs(parameter, config.storagePath, config.outputFileFormat, bunPath);

  const env = { ...process.env };
  const ytdlpDir = path.dirname(ytdlpPath);
  if (process.platform === 'win32') {
    env.Path = `${ytdlpDir};${env.Path || ''}`;
  } else {
    env.PATH = `${ytdlpDir}:${env.PATH || ''}`;
  }

  const childProcess = child.spawn(ytdlpPath, args, { env });
  childProcess.on('error', (err) => {
    log.error(`Erreur lors du lancement de yt-dlp : ${err.message}`);
  });
  childProcess.stdout.on('data', (data) => log.info(`stdout: ${data}`));
  childProcess.stderr.on('data', (data) => log.error(`stderr: ${data}`));
};
const web = express();
web.use(express.json());
web.use(express.urlencoded({ extended: true }));
web.locals.backlogFile = backlogFile;
const helmet = require('helmet');
//web.use(helmet());
//web.use(cors(corsOptions));
const http = require('http').Server(web);
const io = require('socket.io')(http);
const morgan = require('morgan');
const accessLogStream=fs.createWriteStream(path.join(app.getPath('userData'), "./log/access-"+`${new Date().toDateString()}`+".log"))
const errorLogStream=fs.createWriteStream(path.join(app.getPath('userData'), "./log/error-"+`${new Date().toDateString()}`+".log"))
web.use(morgan('combined', {stream: accessLogStream}));
web.use(morgan('combined', {skip: function (req, res) { return res.statusCode < 400 }, stream: errorLogStream}));

// Middleware pour capturer les erreurs Express et les envoyer à LogRocket
web.use((err, req, res, next) => {
  log.error(err);
  next(err);
});

const d = require('./db.js');
const zipUrl = 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
const ffmpegExePath = path.join(app.getPath('userData'), process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');

if (!fs.existsSync(ffmpegExePath)) {
  updateFile(zipUrl, path.join(app.getPath('userData'), 'ffmpeg.zip'))
    .then(() => {
      const unzipper = require('unzipper');
      fs.createReadStream(path.join(app.getPath('userData'), 'ffmpeg.zip'))
        .pipe(unzipper.Extract({ path: path.join(app.getPath('userData'), 'ffmpeg') }))
        .promise()
        .then(() => {
          const binPath = path.join(app.getPath('userData'), 'ffmpeg', 'ffmpeg-master-latest-win64-gpl', 'bin');
          if (fs.existsSync(binPath)) {
            const files = fs.readdirSync(binPath);
            files.forEach(file => {
              fs.copyFileSync(path.join(binPath, file), path.join(app.getPath('userData'), file));
              if (process.platform !== 'win32') {
                fs.chmodSync(path.join(app.getPath('userData'), file), '755');
              }
            });
          }
        });
    })
    .catch(err => log.error('Erreur lors de la mise à jour de FFmpeg:', err));
}
const base = config.storagePath;

web.set('view engine', 'ejs');
web.set('views', path.join(app.getPath('userData'), 'views'));

async function build() {
  const currentVersion = require('../package.json').version;
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

  fs.mkdir(path.join(app.getPath('userData'), "src/"), { recursive: true }, (err) => {
    if (err){} //log.info(err);
  });
  fs.mkdir(path.join(app.getPath('userData'), "src/client-dist"), { recursive: true }, (err) => {
    if (err) {}
  });
  fs.mkdir(path.join(app.getPath('userData'), 'views'), { recursive: true }, (err) => {
    if (err) {}
  });
  fs.mkdir(path.join(app.getPath('userData'), 'log'), { recursive: true }, (err) => {
    if (err) {}
  });
  fs.mkdir(base, { recursive: true }, (err) => {
    if (err) {}
  });
  const bunBinary = process.platform === 'win32' ? 'bun.exe' : 'bun';
  const bunPath = path.join(app.getPath('userData'), bunBinary);
  const bunUrl = process.platform === 'win32' 
    ? 'https://github.com/oven-sh/bun/releases/latest/download/bun-windows-x64.zip' 
    : 'https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64.zip';
  const bunZipName = 'bun.zip';

  // Optimisation: skip heavy downloads if binary already exists and it's not a new version
  const downloads = [];
  if (isNewVersion || !fs.existsSync(path.join(app.getPath('userData'), 'src/client-dist/socket.io.js'))) {
    downloads.push(updateFile('https://cdn.socket.io/4.4.1/socket.io.js', path.join(app.getPath('userData'), 'src/client-dist/socket.io.js'), isNewVersion));
    downloads.push(updateFile('https://cdn.socket.io/4.4.1/socket.io.js.map', path.join(app.getPath('userData'), 'src/client-dist/socket.io.js.map'), isNewVersion));
  }
  
  if (isNewVersion || !fs.existsSync(path.join(app.getPath('userData'), process.platform === 'win32' ? 'ytdlp.exe' : 'ytdlp'))) {
    downloads.push(updateFile(process.platform === 'win32' ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp', path.join(app.getPath('userData'), process.platform === 'win32' ? 'ytdlp.exe' : 'ytdlp'), isNewVersion));
  }

  if (isNewVersion || !fs.existsSync(bunPath)) {
    downloads.push(updateFile(bunUrl, path.join(app.getPath('userData'), bunZipName), isNewVersion));
  }

  // Always update small template files to ensure latest UI
  downloads.push(updateFile('https://raw.githubusercontent.com/thomas-iniguez-visioli/youtube-public/refs/heads/main/src/views/index.ejs', path.join(app.getPath('userData'), 'views','index.ejs'), true));
  downloads.push(updateFile('https://raw.githubusercontent.com/thomas-iniguez-visioli/youtube-public/refs/heads/main/src/views/view.ejs', path.join(app.getPath('userData'), 'views','view.ejs'), true));
  downloads.push(updateFile('https://raw.githubusercontent.com/thomas-iniguez-visioli/youtube-public/refs/heads/main/src/renderer.js', path.join(app.getPath('userData'), 'src/renderer.js'), true));

  try {
    if (downloads.length > 0) {
      await Promise.allSettled(downloads);
      log.info('Initial builds/downloads completed');
      // Sauvegarder la nouvelle version après succès
      fs.writeFileSync(versionFilePath, currentVersion);
    }
    
    // Unzip Bun only if binary is missing
    const bunZipPath = path.join(app.getPath('userData'), 'bun.zip');
    if (fs.existsSync(bunZipPath) && !fs.existsSync(bunPath)) {
      const unzipper = require('unzipper');
      await fs.createReadStream(bunZipPath)
        .pipe(unzipper.Extract({ path: path.join(app.getPath('userData'), 'bun-temp') }))
        .promise();
      
      const bunFolder = process.platform === 'win32' ? 'bun-windows-x64' : 'bun-linux-x64';
      const bunTempDir = path.join(app.getPath('userData'), 'bun-temp', bunFolder);
      
      if (fs.existsSync(path.join(bunTempDir, bunBinary))) {
        fs.copyFileSync(path.join(bunTempDir, bunBinary), bunPath);
        if (process.platform !== 'win32') {
          fs.chmodSync(bunPath, '755');
        }
      }
    }
  } catch (error) {
    log.error('Error during build downloads:', error);
  }
}

try {
  
} catch (error) {
  log.info(error);
  log.error(error);
}
build().then((d)=>{
  web.listen(8001, function () {
    log.info('Listening on port 8001!');
    booted=!booted
  });
})
const db = new d(base);
db.readDatabase()
db.save()
db.database.forEach((item)=>{
  
})

let  promptResponse;
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
  arg.val = arg.val || ''
  const promptHtml = '<label for="val">' + arg.title + '</label>\
  <input id="val" value="' + arg.val + '" autofocus />\
  <button onclick="require(\'electron\').ipcRenderer.send(\'prompt-response\', document.getElementById(\'val\').value);window.close()">Ok</button>\
  <button onclick="window.close()">Cancel</button>\
  <style>body {font-family: sans-serif;} button {float:right; margin-left: 10px;} label,input {margin-bottom: 10px; width: 100%; display:block;}</style>'
  promptWindow.loadURL('data:text/html,' + promptHtml)
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

//const download = require('./ytb');
log.info('boot now');

web.get("/", function (req, res) {
  fs.appendFileSync("./log.txt",app.getPath('exe').split(path.sep)[app.getPath('exe').split(path.sep).length-1])
  autoUpdater.checkForUpdatesAndNotify();
  db.readDatabase();
  db.save();

  // Algorithme de référencement simplifié
  const database = db.database;
  const referencement = database
    .map(item => {
    const infoJsonPath = path.join(app.getPath('userData'), 'file', item.fileName.replace(".mp4", ".info.json"));
    const mp4Path = path.join(app.getPath('userData'), 'file', item.fileName);
    
    // Don't delete files here, just use defaults if info.json is missing
    let infoJson = {};
    if (fs.existsSync(infoJsonPath)) {
      try {
        infoJson = require(infoJsonPath);
      } catch (error) {
        console.error(`Erreur lors de la lecture de ${infoJsonPath}: ${error}`);
      }
    } else {
      console.warn(`Info JSON manquante pour ${item.fileName}`);
    }
    
    if (infoJson.display_id && infoJson.uploader) {
      db.addTag(infoJson.display_id, infoJson.uploader);
    }
    
    const score = (infoJson.view_count || 0) * 0.5 + (infoJson.like_count || 0) * 0.3 + (infoJson.comment_count || 0) * 0.2;
    return { ...item, score, uploader: infoJson.uploader || 'Uploader inconnu' };
  })
  .filter(Boolean)
  .sort((a, b) => b.score - a.score);

  res.render('index', {
    results: referencement,
    channel: null,
    channelUrl: null,
    playlists: db.getPlaylists()
  });
})
web.get("/watch", function (req, res) {
  autoUpdater.checkForUpdatesAndNotify();
  const fileData = db.getFile(req.query.id);
  
  if (!fileData || !fileData.fileName) {
    download(config.videoUrlFormat.replace('${id}', req.query.id));
    return res.redirect("/");
  }

  // Ajouter à l'historique
  db.addToHistory(req.query.id);

  const infoPath = path.join(config.storagePath, fileData.fileName.replace(".mp4", ".info.json"));
  
  let videodata = {};
  if (fs.existsSync(infoPath)) {
    try {
      videodata = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
      // Trigger update metadata in background only if needed
      if (videodata.webpage_url) {
        downloaddata(videodata.webpage_url);
      }
    } catch (e) {
      log.error(`Erreur lecture JSON: ${e.message}`);
    }
  }

  const database = db.database;
  const historyWithoutCurrent = db.history.filter(id => id !== req.query.id);
  const referencement = database.map(item => {
    const itemInfoPath = path.join(config.storagePath, item.fileName.replace(".mp4", ".info.json"));
    let score = 0;
    if (fs.existsSync(itemInfoPath)) {
      try {
        const info = JSON.parse(fs.readFileSync(itemInfoPath, 'utf8'));
        score = (info.view_count || 0) * 0.5 + (info.like_count || 0) * 0.3 + (info.comment_count || 0) * 0.2;
      } catch (e) {}
    }
    return { ...item, score };
  }).sort((a, b) => b.score - a.score);

  const filteredReferencement = referencement.filter(item => !historyWithoutCurrent.includes(item.yid));

  res.render('view', {
    code: req.query.id,
    videos: filteredReferencement,
    title: fileData.fileName,
    videodata: videodata,
    nextVideo: filteredReferencement.findIndex(item => item.yid === req.query.id) === filteredReferencement.length - 1 ? filteredReferencement[0] : filteredReferencement[filteredReferencement.findIndex(item => item.yid === req.query.id) + 1],
    playlists: db.getPlaylists()
  });
});
web.get("/download", function (req, res) {
  console.log(req.query)
  autoUpdater.checkForUpdatesAndNotify();
  download(req.query.url)
  res.redirect("/")
});
web.post("/tag", function (req, res) {
  console.log(req.body)
  const videoId = req.body.videoId;
  const tag = req.body.tag;
  const videoData = db.getFile(videoId);
  if (videoData) {
    if (!videoData.tags.includes(tag)) {
      db.addTag(videoId,tag)
      db.save();
      res.send(`Tag "${tag}" added to video ${videoId}`);
    } else {
      res.send(`Tag "${tag}" already exists for video ${videoId}`);
    }
  } else {
    res.status(404).send(`Video ${videoId} not found`);
  }
});


web.get("/delete", function (req, res) {
 // log.info(req.query)
  fs.rmSync(path.join(base, db.getFile( req.query.id).fileName))
  db.save()
  res.redirect("/")
});
web.get("/api/search", function (req, res) {
  console.log(req.query)
  const tags = req.query.tags.split(',');
  const database = db.database;
  const results = database.filter(item => {
    return tags.some(tag => item.tags.includes(tag.trim()));
  }).map(item => {
    const infoPath = path.join(config.storagePath, item.fileName.replace(".mp4", ".info.json"));
    let uploader = null;
    if (fs.existsSync(infoPath)) {
      try {
        const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        uploader = info.uploader;
      } catch (e) {}
    }
    return { ...item, uploader };
  });
  console.log(results)
  res.json(results);
});

web.get("/channel", function (req, res) {
  const channelName = req.query.name;
  db.readDatabase();
  
  let channelUrl = null;
  const results = db.database.filter(item => {
    const infoPath = path.join(config.storagePath, item.fileName.replace(".mp4", ".info.json"));
    if (fs.existsSync(infoPath)) {
      try {
        const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        if (info.uploader === channelName) {
          if (!channelUrl) channelUrl = info.channel_url || info.uploader_url;
          return true;
        }
      } catch (e) {
        return false;
      }
    }
    return false;
  }).map(item => {
    return { ...item, uploader: channelName };
  });

  res.render('index', {
    results: results,
    channel: channelName,
    channelUrl: channelUrl,
    playlists: db.getPlaylists()
  });
});

web.get("/history", function (req, res) {
  const history = db.getHistory().map(item => {
    const infoPath = path.join(config.storagePath, item.fileName.replace(".mp4", ".info.json"));
    let uploader = "Inconnu";
    if (fs.existsSync(infoPath)) {
      try {
        const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        uploader = info.uploader;
      } catch (e) {}
    }
    return { ...item, uploader };
  });

  res.render('index', {
    results: history,
    channel: "Historique",
    channelUrl: null,
    playlists: db.getPlaylists()
  });
});

web.get("/playlists", function (req, res) {
  res.render('index', {
    results: [],
    channel: "Mes Playlists",
    channelUrl: null,
    playlists: db.getPlaylists()
  });
});

web.get("/playlist", function (req, res) {
  const name = req.query.name;
  const playlist = db.getPlaylist(name);
  
  if (!playlist) return res.redirect("/playlists");

  const results = playlist.videos.map(item => {
    const infoPath = path.join(config.storagePath, item.fileName.replace(".mp4", ".info.json"));
    let uploader = "Inconnu";
    if (fs.existsSync(infoPath)) {
      try {
        const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        uploader = info.uploader;
      } catch (e) {}
    }
    return { ...item, uploader };
  });

  res.render('index', {
    results: results,
    channel: `Playlist : ${name}`,
    channelUrl: null,
    playlists: db.getPlaylists()
  });
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


web.get("/renderer.js",function (req, res) {
  res.statusCode=200
  res.send(fs.readFileSync(path.join(app.getPath('userData'), "./src/renderer.js"))) // Correction pour utiliser path.join pour une construction de chemin valide
})
web.get("/video", limiter, function (req, res) {
  log.info(req.query)  
  log.info(req.headers)
  // Ensure there is a range given for the video
  const range = req.headers.range;
  if (!range) {
    res.status(400).send("Requires Range header");
  }
 // log.info(db.getFile( req.query.id))
  const fileName = db.getFile(req.query.id).fileName;
  if (fileName.includes('../') || fileName.includes('..\\')) {
    return res.status(400).send("Invalid file name");
  }
  const videoPath = path.join(base, fileName);
//  log.info(videoPath)
 // log.info(req.query.id)
  const videoSize = fs.statSync(videoPath).size;

  const CHUNK_SIZE = 10 ** 6; // 1MB
  const start = Number(range.replace(/\D/g, ""));
  const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

  // Create headers
  const contentLength = end - start + 1;
  const headers = {
    "Content-Range": `bytes ${start}-${end}/${videoSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": contentLength,
    "Content-Type": "video/mp4",
  };

  // HTTP Status 206 for Partial Content
  res.writeHead(206, headers);

  // create video read stream for this particular chunk
  const videoStream = fs.createReadStream(videoPath, { start, end });

  // Stream the video chunk to the client
  videoStream.pipe(res);
});
function createWindow() {

  
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Correction pour utiliser path.join pour une construction de chemin valide
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });
  
  const menu = Menu.buildFromTemplate([
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Télécharger une vidéo',
          click() {
            const { dialog } = require('electron');
            log.info(dialog)
         
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'window',
      label: 'Fenêtre',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      role: 'help',
      label: 'Aide',
      submenu: [
        {
          label: 'A propos de l\'application',
          click() {
            dialog.showMessageBox({
              type: 'info',
              icon: path.join(__dirname, 'assets/icon.png'),
              title: 'A propos de l\'application',
              message: 'Ceci est une application de téléchargement de vidéos.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ]);

 // mainWindow.setMenu(menu);
win=mainWindow
autoUpdater.checkForUpdatesAndNotify();
ipcMain.on('execute-command', (e, arg) => {
  const  parameter  = arg;
  log.info(arg)
  var msg =download(parameter)
 
    
    return msg
  
});
  mainWindow.loadURL("http://localhost:8001");

  mainWindow.on('closed', () => {
   delete mainWindow
  });
}
build().then((data)=>{
  app.on('activate', async() => {
    while (!booted) {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    await sleep(10000);
    }
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
})
app.on('ready', () => {
  if (booted) {
    createWindow();
  } else {
    const checkBooted = setInterval(() => {
      if (booted) {
        clearInterval(checkBooted);
        createWindow();
      }
    }, 1000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
